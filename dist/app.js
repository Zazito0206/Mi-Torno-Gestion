import {installScannerLink} from './scanner-ui.mjs';
import {search,move} from './core.mjs';
import {catalogPicture,photoEditor} from './photo.mjs';
import {icon} from './icons.mjs';
import {armFeedback,beep,readImageText,cancelTextReading,printedCodes} from './assist.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let mode='test',view='inventory',query='',stream,timer,db,cameraSession=0;const device=localStorage.mtDevice||crypto.randomUUID();localStorage.mtDevice=device;
const seed=()=>({version:1,products:[['Ketchup de casa','TEST-001','Casa','Botella · 400 g',6,2,'A','1','01','🍅'],['Crema de casa','TEST-002','Casa','Envase · 250 ml',2,3,'A','1','02','🥛'],['Filtro de aceite (ficticio)','FIC-101','DemoParts','Rosca M20 · motor 1.6',12,4,'B','2','01','⚙'],['Pastillas de freno (ficticias)','FIC-102','DemoParts','Delanteras · sedan',0,2,'B','3','02','🔧']].map(([name,code,brand,spec,qty,min,shelf,level,box,emoji])=>({id:crypto.randomUUID(),name,code,brand,spec,qty,min,shelf,level,box,emoji})),events:[]});
const key=()=>`mi-torno-v1-${mode}`;
function load(){try{db=JSON.parse(localStorage.getItem(key()))}catch{db=null}if(!db){db={version:1,products:[],events:[]};save()}if(mode==='test'&&!db.emptyStartApplied){const examples=new Map([['TEST-001','Ketchup de casa'],['TEST-002','Crema de casa'],['FIC-101','Filtro de aceite (ficticio)'],['FIC-102','Pastillas de freno (ficticias)']]);const removed=new Set(db.products.filter(p=>examples.get(p.code)===p.name&&!db.events.some(e=>e.productId===p.id)).map(p=>p.id));db.products=db.products.filter(p=>!removed.has(p.id));db.emptyStartApplied=true;save()}render()}
function save(){try{localStorage.setItem(key(),JSON.stringify(db))}catch{throw Error('No se pudo guardar. Exporta una copia o reduce el tamaño de las fotos.')}}
function commit(fn){const old=structuredClone(db);try{fn();save();render();return true}catch(e){db=old;toast(e.message);return false}}
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4000)}
function modal(html){stop();$('#dialogBody').innerHTML=html;if(!$('#modal').open)$('#modal').showModal()}
function close(){stop();$('#modal').close()}function stop(){cameraSession++;cancelTextReading();clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null}$('#close').onclick=close;$('#modal').addEventListener('cancel',stop);
function render(){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#title').textContent=({inventory:'Inventario',history:'Movimientos',alerts:'Stock bajo',settings:'Datos y ajustes'})[view];$('#banner').textContent=mode==='test'?'◈ Estás en pruebas. Experimenta con libertad: el inventario real está separado.':'Inventario real · Guardado únicamente en este navegador. Exporta copias de seguridad.';const low=db.products.filter(p=>p.qty<=p.min);$('#stats').innerHTML=[['Productos registrados',db.products.length],['Unidades disponibles',db.products.reduce((a,p)=>a+p.qty,0)],['Productos con stock bajo',low.length]].map(([t,n])=>`<div class="stat"><span>${t}</span><b>${n}</b></div>`).join('');
if(view==='settings'){settings();return}if(view==='history'){$('#content').innerHTML=db.events.length?db.events.map(e=>`<div class="history-row"><div><b>${esc(e.name)}</b><small>${esc(({in:'Entrada',out:'Salida',count:'Conteo',create:'Alta',location:'Ubicación'})[e.type]||e.type)} · ${esc(e.note)}<br>${new Date(e.at).toLocaleString('es-SV')}</small></div><div>${e.before} → <b>${e.after}</b></div></div>`).join(''):'<div class="empty">Todavía no hay movimientos. Registra tu primera entrada.</div>';return}
$('#content').innerHTML=`<div class="toolbar"><input id="search" placeholder="Buscar nombre, código, marca, medidas o ubicación…" aria-label="Buscar productos" value="${esc(query)}"><span>${view==='alerts'?'En mínimo o por debajo':'CATÁLOGO DE PRODUCTOS'}</span></div><div class="grid" id="grid"></div>`;$('#search').oninput=e=>{query=e.target.value;cards()};cards();}
function cards(){const ps=search(db.products,query).filter(p=>view!=='alerts'||p.qty<=p.min);$('#grid').innerHTML=ps.map(p=>`<article class="card"><div class="visual">${p.photo?`<img src="${esc(p.photo)}" alt="${esc(p.name)}">`:(p.emoji?esc(p.emoji):icon('box'))}</div><div class="card-body"><span class="code">${esc(p.code)}</span><h3>${esc(p.name)}</h3><div class="meta">${esc(p.brand)} · ${esc(p.spec)}</div><div class="stock"><div><strong>${p.qty}</strong> <small>uds.</small></div><span class="badge ${p.qty<=p.min?'low':''}">${p.qty<=p.min?'Stock bajo':'Disponible'}</span></div><p class="meta">${icon('location')} Estante ${esc(p.shelf||'—')} / Nivel ${esc(p.level||'—')} / Caja ${esc(p.box||'—')}</p><button data-id="${p.id}">Ver ficha y registrar</button></div></article>`).join('')||'<div class="empty">No hay productos para mostrar.</div>';document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>detail(b.dataset.id))}
function detail(id){const p=db.products.find(p=>p.id===id);modal(`<span class="badge">${mode==='test'?'PRUEBAS':'REAL'}</span><h2>${esc(p.name)}</h2><p>${esc(p.code)} · ${esc(p.brand)}<br>${esc(p.spec)}<br>Estante ${esc(p.shelf)} / Nivel ${esc(p.level)} / Caja ${esc(p.box)}</p><h3>${p.qty} unidades · Mínimo ${p.min}</h3><form id="movement"><label>Operación<select name="type"><option value="in">Sumar entrada</option><option value="out">Registrar salida</option><option value="count">Corregir con conteo físico</option></select></label><label>Cantidad (en conteo: total contado)<input name="amount" type="number" min="0" step="1" required value="1"></label><label>Motivo / referencia<input name="note" maxlength="180" placeholder="Ej. compra, trabajo o revisión"></label><p id="difference"></p><button class="primary">Confirmar movimiento</button></form><button id="edit">Corregir ficha o cambiar ubicación</button>`);const f=$('#movement');function diff(){const n=Number(f.amount.value);$('#difference').textContent=f.type.value==='count'?`Conteo: ${p.qty} → ${n}. Diferencia: ${n-p.qty} unidades.`:'La cantidad se aplicará al confirmar.'}f.oninput=diff;diff();f.onsubmit=e=>{e.preventDefault();if(commit(()=>move(db,id,f.type.value,Number(f.amount.value),f.note.value,device))){close();toast('Movimiento guardado')}};$('#edit').onclick=()=>productForm(p)}
function field(label,name,value='',type='text'){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${['name','code'].includes(name)?'required':''} ${type==='number'?'min="0" step="1"':''} maxlength="160"></label>`}
function productForm(p={},code=''){
modal(`<h2>${p.id?'Editar producto':'Nuevo producto'}</h2><form id="product"><div class="fields">
${field('Nombre','name',p.name)}${field('Código único','code',p.code||code)}
<div class="wide"><button type="button" id="scanProductCode">${icon('scan')} Escanear código</button><p id="productCodeStatus" role="status"></p></div>
${field('Marca','brand',p.brand)}${field('Medidas / características','spec',p.spec)}${!p.id?field('Cantidad inicial','qty',0,'number'):''}${field('Stock mínimo','min',p.min||0,'number')}
${field('Estante (opcional)','shelf',p.shelf)}${field('Repisa / nivel (opcional)','level',p.level)}${field('Caja / recipiente (opcional)','box',p.box)}<p class="wide location-help">Ejemplo: estante A → repisa 2 → caja 3. Si no usas repisas o cajas, déjalas vacías.</p>
<section class="wide photo-assist"><h3>${icon('photo')} Foto del catálogo</h3><p>Esta foto solo se usa en el catálogo: no se leen ni rellenan datos. Se intenta limpiar un fondo liso; para quitar una mano o restos de fondo, usa Retocar foto. Revisa la portada antes de guardar.</p>
<label>Tomar o elegir foto del producto<input type="file" name="photo" accept="image/*" capture="environment"></label><div id="catalogPreview" class="catalog-preview"></div><p id="catalogStatus" role="status"></p><div class="photo-actions"><button type="button" id="useOriginal" hidden>Conservar original</button><button type="button" id="useWhite" hidden>Usar fondo blanco</button><button type="button" id="retouchPhoto" hidden>Retocar foto / borrar mano</button></div><div id="photoEditor" class="photo-editor"></div></section>
</div><button class="primary" id="saveProduct">${icon('check')} ${p.id?'Guardar cambios':'Crear producto'}</button></form>`);
const form=$('#product'),saveButton=$('#saveProduct');
let photoId=0,photoBusy=false,catalogPhoto=p.photo||'',catalogResult=null;
const live=()=>form.isConnected&&$('#modal').open;
const showCatalog=()=>{$('#retouchPhoto').hidden=!catalogPhoto;$('#catalogPreview').innerHTML=catalogPhoto?'<img alt="Vista previa de la foto del producto" src="'+esc(catalogPhoto)+'">':''};
showCatalog();
form.addEventListener('remote-catalog-photo',event=>{
const {code,image}=event.detail||{};if(typeof image!=='string'||image.length>500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image)||String(code).toLowerCase()!==form.elements.namedItem('code').value.trim().toLowerCase())return;
form.querySelector('#incomingCatalogPhoto')?.remove();const section=document.createElement('section');section.id='incomingCatalogPhoto';section.className='photo-assist';
section.innerHTML='<h3>Foto recibida del teléfono</h3><div class="catalog-preview"><img alt="Foto del producto recibida del teléfono" src="'+esc(image)+'"></div><button type="button" class="apply-incoming">Usar como foto del catálogo</button><button type="button" class="discard-incoming">Descartar foto recibida</button>';
$('#photoEditor').before(section);
section.querySelector('.discard-incoming').onclick=()=>section.remove();
section.querySelector('.apply-incoming').onclick=async e=>{if(String(code).toLowerCase()!==form.elements.namedItem('code').value.trim().toLowerCase()){toast('El código de la ficha cambió. Revisa a qué producto pertenece la foto.');return}e.target.disabled=true;try{const blob=await fetch(image).then(r=>r.blob());await setCatalog(blob);section.remove()}catch(err){toast(err.message);e.target.disabled=false}};
});
form.elements.namedItem('code').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();armFeedback();beep();$('#productCodeStatus').textContent='Código leído por el lector. Revisa la ficha antes de guardar.'}};
async function setCatalog(file){
$('#photoEditor').replaceChildren();const id=++photoId;photoBusy=true;saveButton.disabled=true;$('#catalogStatus').textContent='Preparando portada y comprobando el fondo…';
try{const result=await catalogPicture(file);if(id!==photoId)return;catalogResult=result;catalogPhoto=result.cleaned||result.original;if(live()){showCatalog();$('#catalogStatus').textContent=result.reason;$('#useOriginal').hidden=!result.cleaned;$('#useWhite').hidden=!result.cleaned}}
catch(e){if(live())$('#catalogStatus').textContent=e.message}
finally{if(id===photoId){photoBusy=false;saveButton.disabled=false}}
}
$('#useOriginal').onclick=()=>{catalogPhoto=catalogResult.original;showCatalog();$('#catalogStatus').textContent='Se guardará la foto original.'};
$('#useWhite').onclick=()=>{catalogPhoto=catalogResult.cleaned;showCatalog();$('#catalogStatus').textContent='Se guardará la versión con fondo blanco. Revisa que el producto esté completo.'};
form.elements.namedItem('photo').onchange=e=>{if(e.target.files[0])setCatalog(e.target.files[0])};
$('#retouchPhoto').onclick=async()=>{
if(photoBusy)return;
try{await photoEditor($('#photoEditor'),catalogPhoto,edited=>{catalogResult??={original:catalogPhoto,cleaned:''};catalogResult.cleaned=edited;catalogPhoto=edited;showCatalog();$('#useOriginal').hidden=false;$('#useWhite').hidden=false;$('#catalogStatus').textContent='Retoque aplicado a la portada. Revisa el producto antes de guardar.'})}catch(e){$('#catalogStatus').textContent=e.message;$('#photoEditor').replaceChildren()}
};
$('#scanProductCode').onclick=()=>{
if(photoBusy){toast('Espera a que termine de preparar la portada.');return}

const body=$('#dialogBody'),savedNodes=Array.from(body.childNodes),restore=()=>{stop();body.replaceChildren(...savedNodes)};
scanner({onBack:restore,onCode:value=>{restore();form.elements.namedItem('code').value=value.trim();const duplicate=db.products.find(x=>x.id!==p.id&&x.code.trim().toLowerCase()===value.trim().toLowerCase());$('#productCodeStatus').textContent=duplicate?'Este código ya existe: '+duplicate.name+'. Al guardar podrás abrir su ficha.':'Código leído. Completa los datos y confirma el producto.';form.elements.namedItem('code').focus()}});
};
form.onsubmit=e=>{
e.preventDefault();if(photoBusy){toast('Espera a que termine la foto.');return}if($('#photoEditor').childElementCount){toast('Aplica o cancela el retoque antes de guardar.');return}
const data=Object.fromEntries(new FormData(form)),duplicate=db.products.find(x=>x.code.trim().toLowerCase()===data.code.trim().toLowerCase()&&x.id!==p.id);
if(duplicate){const body=$('#dialogBody'),savedNodes=Array.from(body.childNodes);modal('<h2>Este código ya existe</h2><p>'+esc(duplicate.name)+' · '+duplicate.qty+' unidades. Abre su ficha para sumar, corregir o cambiar ubicación.</p><button id="existing" class="primary">Abrir ficha existente</button><button id="backDraft" type="button">Volver al producto</button>');$('#existing').onclick=()=>detail(duplicate.id);$('#backDraft').onclick=()=>{stop();$('#dialogBody').replaceChildren(...savedNodes)};return}
const qty=p.id?p.qty:Number(data.qty),min=Number(data.min);if(!Number.isInteger(qty)||qty<0||!Number.isInteger(min)||min<0){toast('Cantidades enteras, cero o mayores');return}
if(commit(()=>{const next={...p,id:p.id||crypto.randomUUID(),name:data.name.trim(),code:data.code.trim(),brand:data.brand.trim(),spec:data.spec.trim(),shelf:data.shelf.trim(),level:data.level.trim(),box:data.box.trim(),qty,min,photo:catalogPhoto};if(!next.name||!next.code)throw Error('Completa nombre y código');if(p.id)db.products=db.products.map(x=>x.id===p.id?next:x);else db.products.push(next);db.events.unshift({id:crypto.randomUUID(),productId:next.id,name:next.name,type:p.id?'location':'create',before:p.qty||0,after:qty,note:p.id?'Ficha actualizada':'Cantidad inicial',at:new Date().toISOString(),device,sync:'local'})})){close();toast('Producto guardado')}
};
}
function identify(code){stop();const p=db.products.find(p=>p.code.toLowerCase()===code.trim().toLowerCase());if(p)detail(p.id);else{modal(`<h2>Código sin registrar</h2><p>${esc(code)} no está en este inventario. No se consultan catálogos externos.</p><button id="newCode" class="primary">Crear producto con este código</button>`);$('#newCode').onclick=()=>productForm({},code)}}
async function scanner(options={}){
armFeedback();
const onCode=typeof options.onCode==='function'?options.onCode:identify;
modal(`<h2>Escanear producto</h2><p>Apunta al código de barras. La lectura abre la ficha; no suma existencias automáticamente.</p><div class="scan-window"><video id="camera" autoplay playsinline muted></video><div class="scan-guide" aria-hidden="true"></div></div><p class="scan-tip">Alinea el código dentro del recuadro</p><p id="cameraStatus" role="status">Solicitando acceso a la cámara…</p><button id="retryCamera" type="button">Reintentar cámara</button> <button id="testBeep" type="button">${icon('volume')} Probar pitido</button><form id="manualCode"><label>Código de barras o impreso<input name="code" required placeholder="Escribe el código si no se puede leer"></label><button class="primary">Buscar código</button></form><label class="code-photo-label">${icon('camera')} Fotografiar código impreso<input type="file" id="printedCodePhoto" accept="image/*" capture="environment"></label><p id="printedCodeStatus" role="status"></p><div id="printedCodeReview"></div><p>Puedes escanear barras, leer los números impresos en una foto o escribirlos manualmente.</p>`);
if(typeof options.onBack==='function'){const back=document.createElement('button');back.type='button';back.textContent='← Volver al producto';back.onclick=()=>{stop();options.onBack()};$('#dialogBody').prepend(back)}
const session=cameraSession,video=$('#camera'),status=$('#cameraStatus');
const active=()=>session===cameraSession&&$('#modal').open&&$('#camera')===video;
$('#retryCamera').onclick=()=>scanner(options);
$('#testBeep').onclick=()=>{armFeedback();beep()};
let accepted=false;
const accept=value=>{value=String(value||'').trim();if(!value||accepted)return;accepted=true;beep();stop();onCode(value)};
$('#manualCode').onsubmit=e=>{e.preventDefault();armFeedback();accept(e.target.code.value)};
$('#printedCodePhoto').onchange=async e=>{
armFeedback();const file=e.target.files[0];if(!file)return;
stream?.getTracks().forEach(t=>t.stop());stream=null;clearTimeout(timer);
status.textContent='Cámara pausada para leer la foto. Puedes reintentar la cámara después.';
const message=$('#printedCodeStatus'),panel=$('#printedCodeReview');panel.replaceChildren();
try{const result=await readImageText(file,text=>{if(active())message.textContent=text});if(!active())return;
const candidates=[...new Set([result.barcode,...printedCodes(result.text)].filter(Boolean))];
message.textContent=candidates.length?'Revisa el código leído y confirma. No se registra nada sin confirmar.':'No se distinguió un código seguro. Revisa el texto o escríbelo manualmente.';
panel.innerHTML=(candidates.length?'<label>Código leído<select id="printedCandidate">'+candidates.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('')+'</select></label><button type="button" id="acceptPrinted">Usar este código</button>':'')+'<details><summary>Ver texto leído</summary><pre></pre></details>';
panel.querySelector('pre').textContent=result.text;
if(candidates.length)$('#acceptPrinted').onclick=()=>accept($('#printedCandidate').value);
}catch(err){if(active())message.textContent=err.message}
};
try{
if(!window.isSecureContext)throw Error('La cámara necesita una conexión segura. Abre la dirección HTTPS de Vercel.');
if(!navigator.mediaDevices?.getUserMedia)throw Error('Este navegador no permite acceder a la cámara. Abre la aplicación directamente en Safari o Chrome.');
const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
if(!active()){acquired.getTracks().forEach(t=>t.stop());return}
stream=acquired;video.srcObject=acquired;await video.play();
if(!active())return;
status.textContent='Cámara activa. Comprobando lectura automática…';
let detector;
try{
if(!('BarcodeDetector' in window))throw Error();
const formats=await window.BarcodeDetector.getSupportedFormats();
if(!formats.length)throw Error();
detector=new window.BarcodeDetector({formats});
}catch{
if(active())status.textContent='Cámara activa. Este navegador no ofrece lectura automática de barras; fotografía los números del código o escríbelos abajo.';
return;
}
if(!active())return;
status.textContent='Cámara activa. Coloca el código dentro de la imagen.';
async function tick(){
if(!active()||!stream)return;
try{const canvas=document.createElement('canvas');const ratio=2.4,vw=video.videoWidth,vh=video.videoHeight;if(!vw||!vh)throw Error();const w=Math.min(vw,vh*ratio),h=w/ratio;canvas.width=Math.min(w,1280);canvas.height=canvas.width/ratio;canvas.getContext('2d').drawImage(video,(vw-w)/2,(vh-h)/2,w,h,0,0,canvas.width,canvas.height);const results=await detector.detect(canvas);if(!active())return;if(results.length){accept(results[0].rawValue);return}}catch{if(active())status.textContent='Cámara activa. No se pudo leer el código; acércalo con buena luz o escríbelo abajo.'}
if(active())timer=setTimeout(tick,450);
}
tick();
}catch(e){
if(!active())return;
stop();
const messages={NotAllowedError:'El acceso a la cámara está bloqueado o fue rechazado. En los permisos de este sitio, permite Cámara y pulsa Reintentar cámara.',NotFoundError:'No se encontró una cámara disponible en este dispositivo.',NotReadableError:'No se pudo iniciar la cámara. Cierra otras aplicaciones que la estén usando y vuelve a intentar.',OverconstrainedError:'La cámara no admite la configuración solicitada. Prueba otro navegador.'};
status.textContent=messages[e.name]||e.message||'No se pudo abrir la cámara. Puedes escribir el código manualmente.';
}
}
function settings(){$('#content').innerHTML=`<div class="panel"><h2>Tu información, bajo control</h2><p>Los datos viven en este navegador y pueden perderse si se borra su almacenamiento. Cada dispositivo tiene su propio inventario. Exporta una copia después de trabajar.</p><button id="export">${icon('download')} Exportar copia JSON (${mode==='test'?'pruebas':'real'})</button></div><div class="panel"><h3>Modo de pruebas</h3><p>Limpiar borra solo productos e historial de pruebas. El inventario real se conserva.</p><button id="clear">Limpiar pruebas</button> <button id="seed">Cargar ejemplos de nuevo</button></div><div class="panel"><h3>Conexión entre equipos · Próxima etapa</h3><p>Sin backend ni sincronización activa. La arquitectura separa catálogo y movimientos con identificadores únicos, dispositivo y versión. Hace falta un servidor, usuarios y resolución de conflictos antes de usar dos equipos sobre el mismo inventario.</p><p>Instalación PWA y cámara requieren HTTPS o localhost; el modo sin conexión necesita una primera carga completa.</p></div>`;$('#export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({environment:mode,exportedAt:new Date().toISOString(),...db},null,2)],{type:'application/json'}));a.href=url;a.download=`mi-torno-${mode}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('#clear').onclick=()=>{if(confirm('¿Borrar productos e historial SOLO de PRUEBAS?')){localStorage.setItem('mi-torno-v1-test',JSON.stringify({version:1,products:[],events:[]}));load();toast('Pruebas limpiadas; inventario real conservado')}};$('#seed').onclick=()=>{if(confirm('¿Reemplazar las pruebas actuales con los ejemplos?')){localStorage.setItem('mi-torno-v1-test',JSON.stringify(seed()));load();toast('Ejemplos cargados en pruebas')}}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;query='';render()});$('#mode').onchange=e=>{close();mode=e.target.value;query='';load()};$('#add').onclick=()=>productForm();$('#scan').onclick=scanner;
for(const [selector,name,label] of [['#scan','scan','Escanear'],['#add','plus','Nuevo producto'],['[data-view="inventory"]','box','Inventario'],['[data-view="history"]','history','Movimientos'],['[data-view="alerts"]','alert','Stock bajo'],['[data-view="settings"]','settings','Datos y ajustes']])$(selector).innerHTML=icon(name)+'<span>'+label+'</span>';
load();installScannerLink({modal,scanner,identify,toast,armFeedback,beep,icon,reviewPhoto:photo=>{const p=db.products.find(item=>item.code.toLowerCase()===photo.code.toLowerCase());productForm(p||{},photo.code);$('#product').dispatchEvent(new CustomEvent('remote-catalog-photo',{detail:photo}))}});if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
