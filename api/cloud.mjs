import {createSession,validSession,sessionCookie,readCookie,allowedOrigin,sameSecret,loginBucket,COOKIE} from '../server/session.mjs';
const MAX_BODY=3000000;
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const url=process.env.MT_CLOUD_URL,token=process.env.MT_CLOUD_BRIDGE_TOKEN,secret=process.env.MT_SESSION_SECRET,access=process.env.MT_ACCESS_CODE,configured=!!(url&&token&&secret?.length>=32&&access?.length>=10),op=String(req.query?.op||new URL(req.url,'https://local').searchParams.get('op')||'status');
 const answer=(status,body)=>res.status(status).json(body),authenticated=configured&&validSession(readCookie(req.headers.cookie),secret);
 if(op==='status')return answer(200,{configured,authenticated,version:'1P'});
 if(!configured)return answer(503,{error:'CLOUD_NOT_CONFIGURED',message:'El guardado en la nube aún no está configurado.'});
 if(!['GET','POST'].includes(req.method))return answer(405,{error:'METHOD_NOT_ALLOWED'});
 if(req.method==='POST'&&!allowedOrigin(req))return answer(403,{error:'INVALID_ORIGIN',message:'Abre la aplicación desde su dirección habitual.'});
 const bridge=async body=>{const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});const result=await response.json();if(!response.ok){const e=Error(result.message||'No se pudo completar la operación en la nube.');e.status=response.status;e.code=result.error;throw e}return result};
 try{
  let body=req.body||{};if(typeof body==='string'){if(body.length>MAX_BODY)return answer(413,{error:'PAYLOAD_TOO_LARGE'});body=JSON.parse(body)}if(JSON.stringify(body).length>MAX_BODY)return answer(413,{error:'PAYLOAD_TOO_LARGE'});
  if(op==='login'){
   if(req.method!=='POST')return answer(405,{error:'METHOD_NOT_ALLOWED'});const limit=await bridge({op:'login-limit',key:loginBucket(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown',secret)});if(!limit.allowed)return answer(429,{error:'RATE_LIMITED',message:'Demasiados intentos. Espera quince minutos antes de volver a entrar.'});if(!sameSecret(body.code||'',access))return answer(401,{error:'INVALID_CODE',message:'La clave del taller no es correcta.'});res.setHeader('Set-Cookie',sessionCookie(createSession(secret)));return answer(200,{authenticated:true});
  }
  if(!authenticated)return answer(401,{error:'AUTH_REQUIRED',message:'Ingresa la clave del taller para abrir el inventario compartido.'});
  if(op==='logout'){if(req.method!=='POST')return answer(405,{error:'METHOD_NOT_ALLOWED'});res.setHeader('Set-Cookie',COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return answer(200,{authenticated:false})}
  const getOps=['meta','state','events','photo'],postOps=['commit','import-start','import-batch','import-finish'];if(req.method==='GET'&&!getOps.includes(op)||req.method==='POST'&&!postOps.includes(op))return answer(405,{error:'METHOD_NOT_ALLOWED'});
  const query=Object.fromEntries(new URL(req.url,'https://local').searchParams);const payload=req.method==='GET'?{...query,op,offset:Number(query.offset||0),...(query.revision!==undefined?{revision:Number(query.revision)}:{})}:{...body,op};const result=await bridge(payload);
  if(op==='photo'){const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(result.image||'');if(!match)return answer(502,{error:'INVALID_PHOTO'});res.setHeader('Content-Type',match[1]);return res.status(200).send(Buffer.from(match[2],'base64'))}
  return answer(200,result);
 }catch(e){return answer(e.status||503,{error:e.code||'CLOUD_UNAVAILABLE',message:e.status?e.message:'No se pudo contactar con el guardado en la nube. Revisa la conexión; no se guardará localmente.'})}
}
