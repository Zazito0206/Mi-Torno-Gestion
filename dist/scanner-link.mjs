const scripts=new Map();
async function script(src,globalName){if(globalThis[globalName])return globalThis[globalName];if(!scripts.has(src))scripts.set(src,new Promise((resolve,reject)=>{const el=document.createElement('script');let timeout=setTimeout(()=>{el.remove();scripts.delete(src);reject(Error('No se pudo cargar el servicio de vinculación. Comprueba la conexión e inténtalo de nuevo.'))},20000);el.src=src;el.async=true;el.onload=()=>{clearTimeout(timeout);if(globalThis[globalName])resolve(globalThis[globalName]);else{scripts.delete(src);reject(Error('No se pudo iniciar la vinculación.'))}};el.onerror=()=>{clearTimeout(timeout);el.remove();scripts.delete(src);reject(Error('No se pudo descargar el servicio de vinculación.'))};document.head.append(el)}));return scripts.get(src)}
const peerClass=()=>script('https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js','Peer');
const options={secure:true,debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}};
export function cleanScan(value){return typeof value==='string'&&value.trim().length>0&&value.trim().length<=160&&!/[\x00-\x1f\x7f]/.test(value)?value.trim():null}
export function parseScannerInvite(value){try{const u=new URL(value),p=new URLSearchParams(u.hash.slice(1)),id=p.get('scanner'),token=p.get('key');return /^mtg-[a-f0-9-]{36}$/.test(id||'')&&/^[a-f0-9-]{36}$/.test(token||'')?{id,token}:null}catch{return null}}
export async function scannerQR(url){const make=await script('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js','qrcode');const qr=make(0,'M');qr.addData(url);qr.make();return qr.createSvgTag({cellSize:4,margin:12,scalable:true})}
function ready(peer,status){return new Promise((resolve,reject)=>{let opened=false;const timeout=setTimeout(()=>{peer.destroy();reject(Error('No respondió el servicio de enlace. Intenta de nuevo con ambas pantallas conectadas a internet.'))},20000);peer.on('open',id=>{opened=true;clearTimeout(timeout);resolve(id)});peer.on('error',e=>{const message=e.type==='peer-unavailable'?'La pantalla receptora no está disponible. Genera un enlace nuevo.':'Falló el enlace entre dispositivos. Prueba la misma red Wi-Fi y vuelve a vincular.';if(!opened){clearTimeout(timeout);peer.destroy();reject(Error(message))}else status?.({state:'error',message})})})}
export async function createHostSession({onStatus=()=>{},onPending=()=>{},onScan=()=>{},onPhoto=()=>{},PeerClass,baseURL=location.href}={}){
const Peer=PeerClass||await peerClass(),id='mtg-'+crypto.randomUUID(),token=crypto.randomUUID(),peer=new Peer(id,options),connections=new Set(),seen=new Set(),inflight=new Set();let closed=false,approved=null;const started=Date.now();
const notify=(state,message)=>{if(!closed)onStatus({state,message})};
const close=()=>{if(closed)return;closed=true;for(const c of connections)c.close();connections.clear();peer.destroy();onStatus({state:'closed',message:'Escáner desconectado'})};
peer.on('connection',conn=>{
if(closed||connections.size>=3||Date.now()-started>600000){conn.close();return}connections.add(conn);let allowed=false,pending=false,photo=null;let last=0;
const wait=setTimeout(()=>{if(!allowed)conn.close()},60000);
conn.on('data',async data=>{
if(closed||!data||typeof data!=='object')return;
if(data.type==='hello'&&!pending&&!allowed){if(data.token!==token||approved){conn.close();return}pending=true;const name=typeof data.name==='string'?data.name.slice(0,50):'Teléfono';
onPending({name,approve:()=>{if(closed||!conn.open||approved&&approved!==conn)return;clearTimeout(wait);approved=conn;allowed=true;conn.send({type:'ready'});notify('connected','Teléfono vinculado')},reject:()=>conn.close()});notify('pending','Autoriza el teléfono para recibir lecturas');return}
if(data.type==='ping'){if(allowed)conn.send({type:'pong'});return}
if(allowed&&approved===conn&&data.type==='photo-start'){
if(typeof data.id!=='string'||data.id.length>80||!cleanScan(data.code)||!Number.isInteger(data.parts)||data.parts<1||data.parts>42||!Number.isInteger(data.length)||data.length>500000||data.length<24)return;
if(seen.has(data.id)){conn.send({type:'ack',id:data.id});return}if(photo){conn.send({type:'busy',id:data.id});return}
photo={id:data.id,code:cleanScan(data.code),parts:data.parts,length:data.length,chunks:[],received:0,timer:setTimeout(()=>{photo=null},20000)};return;
}
if(allowed&&approved===conn&&data.type==='photo-chunk'){
if(!photo||data.id!==photo.id||!Number.isInteger(data.index)||data.index<0||data.index>=photo.parts||typeof data.chunk!=='string'||data.chunk.length>12000||photo.chunks[data.index]!==undefined)return;
photo.chunks[data.index]=data.chunk;photo.received++;if(photo.received!==photo.parts)return;
const item=photo;photo=null;clearTimeout(item.timer);const image=item.chunks.join('');if(image.length!==item.length||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image)){conn.send({type:'busy',id:item.id});return}
try{await onPhoto({code:item.code,image});seen.add(item.id);if(seen.size>200)seen.delete(seen.values().next().value);if(conn.open)conn.send({type:'ack',id:item.id})}catch{if(conn.open)conn.send({type:'busy',id:item.id})}return;
}
if(data.type!=='scan'||!allowed||approved!==conn)return;
const code=cleanScan(data.code);if(!code||typeof data.id!=='string'||data.id.length>80)return;
if(seen.has(data.id)){conn.send({type:'ack',id:data.id});return}
if(inflight.has(data.id))return;
if(Date.now()-last<250){conn.send({type:'busy',id:data.id});return}last=Date.now();
inflight.add(data.id);try{await onScan(code);seen.add(data.id);if(seen.size>200)seen.delete(seen.values().next().value);if(conn.open)conn.send({type:'ack',id:data.id})}catch{if(conn.open)conn.send({type:'busy',id:data.id})}finally{inflight.delete(data.id)}
});
conn.on('close',()=>{clearTimeout(wait);if(photo)clearTimeout(photo.timer);photo=null;connections.delete(conn);if(approved===conn){approved=null;notify('waiting','Teléfono desconectado. Puedes volver a vincular.')}});conn.on('error',()=>{conn.close()});
});
await ready(peer,onStatus);if(closed)throw Error('Vinculación cancelada.');const url=new URL(baseURL);url.hash=new URLSearchParams({scanner:id,key:token}).toString();notify('waiting','Esperando el teléfono');return {url:url.href,close,get connected(){return !!approved?.open}};
}
export async function createPhoneSession(invite,{name='Teléfono',onStatus=()=>{},PeerClass}={}){
if(!invite||!/^mtg-[a-f0-9-]{36}$/.test(invite.id)||!/^[a-f0-9-]{36}$/.test(invite.token))throw Error('El enlace no es válido. Genera uno nuevo desde la tablet.');
const Peer=PeerClass||await peerClass(),peer=new Peer(undefined,options),pending=new Map();let conn,allowed=false,closed=false,heartbeat,connectTimeout,lastPong=Date.now();
const notify=(state,message)=>{if(!closed)onStatus({state,message})};
const close=()=>{if(closed)return;closed=true;allowed=false;clearInterval(heartbeat);clearTimeout(connectTimeout);for(const item of pending.values()){clearTimeout(item.timeout);item.reject(Error('El escáner se desconectó.'))}pending.clear();conn?.close();peer.destroy();onStatus({state:'closed',message:'Teléfono desconectado'})};
try{await ready(peer,onStatus);if(closed)throw Error('Enlace cancelado.');conn=peer.connect(invite.id,{reliable:true,serialization:'json',label:'mi-torno-scanner-v1'});
connectTimeout=setTimeout(()=>{if(!allowed){notify('error','No se completó la vinculación. Revisa la autorización en la tablet y prueba la misma red Wi-Fi.');close()}},60000);
conn.on('open',()=>{conn.send({type:'hello',token:invite.token,name:String(name).slice(0,50)});notify('pending','Conectando. Autoriza este teléfono en la pantalla receptora.')});
conn.on('data',data=>{if(!data||typeof data!=='object')return;if(data.type==='ready'){allowed=true;clearTimeout(connectTimeout);lastPong=Date.now();notify('connected','Vinculado. Listo para enviar códigos');heartbeat=setInterval(()=>{if(Date.now()-lastPong>25000){notify('error','Se perdió la conexión. Vuelve a vincular el teléfono.');close();return}if(conn.open)conn.send({type:'ping'})},8000)}else if(data.type==='pong')lastPong=Date.now();else if((data.type==='ack'||data.type==='busy')&&pending.has(data.id)){const task=pending.get(data.id);clearTimeout(task.timeout);pending.delete(data.id);if(data.type==='ack')task.resolve();else task.reject(Error('La pantalla está ocupada. Espera un momento y vuelve a escanear.'))}});
conn.on('close',close);conn.on('error',()=>{notify('error','No se pudo conectar con la pantalla receptora.');close()});
}catch(e){close();throw e}
const send=code=>{code=cleanScan(code);if(!code)return Promise.reject(Error('El código no es válido.'));if(!allowed||!conn?.open||closed)return Promise.reject(Error('El teléfono no está vinculado.'));if(pending.size)return Promise.reject(Error('Espera la confirmación de la lectura anterior.'));const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pending.delete(id);reject(Error('No se confirmó la recepción. Revisa la tablet antes de reintentar.'))},10000);pending.set(id,{resolve,reject,timeout});try{conn.send({type:'scan',id,code})}catch{clearTimeout(timeout);pending.delete(id);reject(Error('No se pudo enviar el código. Vuelve a vincular.'))}})};
const sendPhoto=(code,image)=>{code=cleanScan(code);if(!code||typeof image!=='string'||image.length>500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image))return Promise.reject(Error('La foto no es válida o es demasiado grande.'));if(!allowed||!conn?.open||closed)return Promise.reject(Error('El teléfono no está vinculado.'));if(pending.size)return Promise.reject(Error('Espera la confirmación anterior.'));const id=crypto.randomUUID(),parts=Math.ceil(image.length/12000);return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pending.delete(id);reject(Error('No se confirmó la foto. Revisa la tablet antes de reintentar.'))},25000);pending.set(id,{resolve,reject,timeout});try{conn.send({type:'photo-start',id,code,length:image.length,parts});for(let index=0;index<parts;index++)conn.send({type:'photo-chunk',id,index,chunk:image.slice(index*12000,(index+1)*12000)})}catch{clearTimeout(timeout);pending.delete(id);reject(Error('No se pudo enviar la foto. Vuelve a vincular.'))}})};
return {close,send,sendPhoto,get connected(){return allowed&&!!conn?.open&&!closed}};
}
