export async function imageCanvas(file,maxSize=1600){
if(file.size>20000000)throw Error('La foto supera 20 MB. Usa una imagen más pequeña.');
let image,release=()=>{};
try{image=await createImageBitmap(file);release=()=>image.close()}catch{const url=URL.createObjectURL(file);try{image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Este formato de foto no se pudo abrir. Usa JPG, PNG o WebP.'));img.src=url});release=()=>URL.revokeObjectURL(url)}catch(e){URL.revokeObjectURL(url);throw e}}
try{const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight;if(!w||!h)throw Error('No se pudo abrir la foto.');const scale=Math.min(1,maxSize/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*scale);c.height=Math.round(h*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);return c}finally{release()}
}
// Conservative edge-connected segmentation for plain backgrounds. Never guesses a busy scene.
export function plainBackgroundMask(data,w,h){
const color=(x,y)=>{const i=(y*w+x)*4;return [data[i],data[i+1],data[i+2]]};
const patch=Math.max(2,Math.floor(Math.min(w,h)*.025));const corners=[[0,0],[w-patch,0],[0,h-patch],[w-patch,h-patch]].map(([x,y])=>{const samples=[];for(let j=y;j<y+patch;j++)for(let i=x;i<x+patch;i++)samples.push(color(i,j));return [0,1,2].map(k=>{const values=samples.map(c=>c[k]).sort((a,b)=>a-b);return values[values.length>>1]})});
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);const consistent=corners.every(c=>distance(c,corners[0])<65);if(!consistent)return {ok:false,reason:'El fondo tiene varios colores o detalles. Conserva la original o toma la foto sobre una superficie lisa.'};
const bg=[0,1,2].map(k=>corners.reduce((n,c)=>n+c[k],0)/4);const seen=new Uint8Array(w*h),mask=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
const push=i=>{if(seen[i])return;seen[i]=1;const p=i*4;if(data[p+3]<20||distance([data[p],data[p+1],data[p+2]],bg)<52){mask[i]=1;queue[tail++]=i}};
for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);if(x)push(i-1);if(x<w-1)push(i+1);if(y)push(i-w);if(y<h-1)push(i+w)}
const fraction=tail/(w*h);if(fraction<.12||fraction>.9)return {ok:false,reason:'No se pudo separar el producto con suficiente seguridad. Conserva la original o prueba un fondo liso que contraste.'};
let minX=w,minY=h,maxX=0,maxY=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!mask[y*w+x]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
if(minX<w*.025||maxX>w*.975||minY<h*.025||maxY>h*.975)return {ok:false,reason:'El producto parece tocar un borde. Deja espacio a su alrededor para recortarlo.'};
return {ok:true,mask,bounds:{minX,minY,maxX,maxY}};
}
export async function catalogPicture(file){const canvas=await imageCanvas(file,800),ctx=canvas.getContext('2d'),original=canvas.toDataURL('image/jpeg',.85),image=ctx.getImageData(0,0,canvas.width,canvas.height);const result=plainBackgroundMask(image.data,canvas.width,canvas.height);if(!result.ok)return {original,cleaned:'',reason:result.reason};
for(let i=0;i<result.mask.length;i++)if(result.mask[i]){image.data[i*4]=255;image.data[i*4+1]=255;image.data[i*4+2]=255;image.data[i*4+3]=255}ctx.putImageData(image,0,0);
const {minX,minY,maxX,maxY}=result.bounds,w=maxX-minX+1,h=maxY-minY+1,size=Math.ceil(Math.max(w,h)*1.15),out=document.createElement('canvas');out.width=out.height=800;const dest=out.getContext('2d');dest.fillStyle='#fff';dest.fillRect(0,0,800,800);const scale=800/size;dest.drawImage(canvas,minX,minY,w,h,(800-w*scale)/2,(800-h*scale)/2,w*scale,h*scale);return {original,cleaned:out.toDataURL('image/jpeg',.88),reason:'Fondo blanco preparado. Revisa que el producto esté completo antes de usarlo.'};}

export function eraseLine(ctx,from,to,size){ctx.save();ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.beginPath();ctx.arc(to.x,to.y,size/2,0,Math.PI*2);ctx.fill();ctx.restore()}
export async function photoEditor(host,source,onApply){
host.innerHTML='<h3>Retoque sobre fondo blanco</h3><p>Pasa el dedo o el mouse sobre la mano o el fondo que quieras borrar. Evita tocar el producto. Puedes deshacer cada trazo.</p><label>Tamaño del borrador<input id="eraseSize" type="range" min="4" max="100" value="30"></label><canvas id="eraseCanvas" aria-label="Foto para borrar manualmente mano y fondo"></canvas><div class="photo-actions"><button type="button" id="eraseUndo" disabled>Deshacer trazo</button><button type="button" id="eraseCancel">Cancelar retoque</button><button type="button" id="eraseApply">Aplicar retoque</button></div><p id="eraseStatus" role="status">Cargando foto…</p>';
const canvas=host.querySelector('#eraseCanvas'),ctx=canvas.getContext('2d'),undo=host.querySelector('#eraseUndo'),size=host.querySelector('#eraseSize'),status=host.querySelector('#eraseStatus'),history=[];
let ready=false,drawing=false,last,pointer;
host.querySelector('#eraseCancel').onclick=()=>host.replaceChildren();
const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('No se pudo abrir esta imagen para retocar.'));image.src=source});
if(!canvas.isConnected)return;
const scale=Math.min(1,800/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);ready=true;status.textContent='Listo. El borrado es manual; no se detecta la mano automáticamente.';
const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
const diameter=()=>Number(size.value)*canvas.width/canvas.getBoundingClientRect().width;
canvas.onpointerdown=e=>{if(!ready||drawing)return;e.preventDefault();history.push(ctx.getImageData(0,0,canvas.width,canvas.height));if(history.length>6)history.shift();undo.disabled=false;drawing=true;pointer=e.pointerId;last=point(e);canvas.setPointerCapture(pointer);eraseLine(ctx,last,last,diameter())};
canvas.onpointermove=e=>{if(!drawing||e.pointerId!==pointer)return;e.preventDefault();const next=point(e);eraseLine(ctx,last,next,diameter());last=next};
const finish=e=>{if(!drawing||e.pointerId!==pointer)return;drawing=false;if(canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer)};canvas.onpointerup=finish;canvas.onpointercancel=finish;
undo.onclick=()=>{if(!history.length)return;drawing=false;ctx.putImageData(history.pop(),0,0);undo.disabled=!history.length};
host.querySelector('#eraseApply').onclick=()=>{if(!ready)return;onApply(canvas.toDataURL('image/jpeg',.9));host.replaceChildren()};
}
