import {mutation,packProducts,packEvents,environment,revision,identifier,publicProduct,MAX_BODY} from './cloud-domain.mjs';
const BRIDGE_SHA256='d11e267b24a4b5229a2cf3e393eea3dc5428cffb8d4cc04fc12b55991b654baa';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
class Failure extends Error{status:number;code:string;constructor(message:string,status=400,code='INVALID_REQUEST'){super(message);this.status=status;this.code=code}}
async function db(path:string,method='GET',body?:unknown,extra:Record<string,string>={}){
 const url=Deno.env.get('SUPABASE_URL');let key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!key){try{const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');key=keys.default||Object.values(keys)[0] as string}catch{}}
 if(!url||!key)throw new Failure('El servidor de datos no está configurado.',503,'CLOUD_NOT_READY');
 const headers:Record<string,string>={apikey:key,'Content-Type':'application/json',...extra};if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const response=await fetch(url+'/rest/v1/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{throw new Failure('Respuesta inválida del servidor de datos.',502)}
 if(!response.ok){if((data?.code==='40001'||data?.code==='PT409'))throw new Failure('El inventario cambió en otro dispositivo. Actualiza y revisa antes de guardar.',409,'REVISION_CONFLICT');if(data?.code==='23505')throw new Failure('Ya existe un producto o movimiento con ese identificador.',409,'DUPLICATE_CODE');throw new Failure('No se pudo completar la operación en la base de datos.',500,'DATABASE_ERROR')}
 return {data,total:Number(response.headers.get('content-range')?.split('/')[1]||0)};
}
const rpc=async(name:string,args:unknown)=>(await db('rpc/'+name,'POST',args)).data;
async function meta(env:string){return (await db('mtg_meta?environment=eq.'+env+'&select=revision,updated_at')).data[0]}
async function checkRevision(env:string,value:unknown){const current=await meta(env);if(!current)throw new Failure('No se encontró el inventario.',503,'CLOUD_NOT_READY');if(value!==undefined&&current.revision!==revision(value))throw new Failure('El inventario cambió. Actualiza antes de continuar.',409,'REVISION_CONFLICT');return current}
Deno.serve(async req=>{
 try{
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'',hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==BRIDGE_SHA256)return json({error:'UNAUTHORIZED'},401);
  const text=await req.text();if(text.length>MAX_BODY)return json({error:'PAYLOAD_TOO_LARGE'},413);const body=JSON.parse(text),op=body.op;
  if(op==='login-limit'){if(!/^[a-f0-9]{64}$/.test(body.key||''))throw new Failure('Solicitud inválida.');return json({allowed:await rpc('mtg_allow_login',{p_key:body.key})})}
  const env=environment(body.environment);
  if(op==='meta')return json(await checkRevision(env,undefined));
  if(op==='state'){
   const before=await checkRevision(env,body.revision),offset=Number(body.offset||0);if(!Number.isInteger(offset)||offset<0||offset>10000)throw new Failure('Página inválida.');
   const products=await db('mtg_products?environment=eq.'+env+'&select=id,doc,photo_version&order=id.asc&offset='+offset+'&limit=200','GET',undefined,{Prefer:'count=exact'});const events=offset===0?await db('mtg_events?environment=eq.'+env+'&select=doc&order=happened_at.desc,id.asc&limit=500','GET',undefined,{Prefer:'count=exact'}):{data:[],total:0};await checkRevision(env,before.revision);
   return json({version:1,environment:env,revision:before.revision,modifiedAt:before.updated_at,products:products.data.map((row:any)=>publicProduct(row,env)),events:events.data.map((row:any)=>row.doc),total:products.total,eventTotal:events.total,nextOffset:offset+products.data.length<products.total?offset+products.data.length:null});
  }
  if(op==='events'){const before=await checkRevision(env,body.revision),offset=Number(body.offset||0);if(!Number.isInteger(offset)||offset<0||offset>100000)throw new Failure('Página inválida.');const result=await db('mtg_events?environment=eq.'+env+'&select=doc&order=happened_at.desc,id.asc&offset='+offset+'&limit=500','GET',undefined,{Prefer:'count=exact'});await checkRevision(env,before.revision);return json({revision:before.revision,events:result.data.map((r:any)=>r.doc),total:result.total})}
  if(op==='photo'){const id=identifier(body.id),row=(await db('mtg_products?environment=eq.'+env+'&id=eq.'+encodeURIComponent(id)+'&select=photo,photo_version')).data[0];if(!row?.photo)throw new Failure('No hay foto para este producto.',404,'PHOTO_NOT_FOUND');return json({image:row.photo,version:row.photo_version})}
  if(op==='commit'){return json(await rpc('mtg_commit',mutation(body)))}
  if(op==='import-start'){
   await checkRevision(env,body.baseRevision);if(!Number.isInteger(body.productCount)||body.productCount<0||body.productCount>10000||!Number.isInteger(body.eventCount)||body.eventCount<0||body.eventCount>100000)throw new Failure('Conteo de importación inválido.');const id=crypto.randomUUID();await db('mtg_imports','POST',{id,environment:env,base_revision:revision(body.baseRevision),product_count:body.productCount,event_count:body.eventCount});return json({sessionId:id});
  }
  if(op==='import-batch'){
   const id=identifier(body.sessionId),record=(await db('mtg_imports?id=eq.'+encodeURIComponent(id)+'&environment=eq.'+env+'&select=id,expires_at,applied_revision')).data[0];if(!record||record.applied_revision!==null||Date.parse(record.expires_at)<Date.now())throw new Failure('La importación terminó o venció.',409,'IMPORT_EXPIRED');if(!['products','events'].includes(body.kind)||!Number.isInteger(body.part)||body.part<0||body.part>10000)throw new Failure('Parte de importación inválida.');const items=body.kind==='products'?packProducts(body.items,env,true):packEvents(body.items);await db('mtg_import_chunks?on_conflict=session_id,kind,part','POST',{session_id:id,kind:body.kind,part:body.part,items},{Prefer:'resolution=merge-duplicates'});return json({staged:true});
  }
  if(op==='import-finish'){const id=identifier(body.sessionId),record=(await db('mtg_imports?id=eq.'+encodeURIComponent(id)+'&environment=eq.'+env+'&select=id')).data[0];if(!record)throw new Failure('Importación no encontrada.',404);return json(await rpc('mtg_finish_import',{p_session:id}))}
  throw new Failure('Operación no válida.');
 }catch(error){const e=error as Failure;return json({error:e.code||'INVALID_REQUEST',message:e.status?e.message:'La solicitud contiene datos inválidos.'},e.status||400)}
});
