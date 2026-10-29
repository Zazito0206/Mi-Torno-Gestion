import {CloudInventory} from './cloud.mjs';
import {RELEASE,validateInventory,canonicalCode,sharedSnapshot,applySharedMove} from './beta.mjs';
import {dataSettings,restockView,showGuide} from './data-ui.mjs';
import {makeQRDetector} from './scanner-link.mjs';
import {installScannerLink} from './scanner-ui.mjs';
import {search,move} from './core.mjs';
import {catalogPicture,photoEditor} from './photo.mjs';
import {icon} from './icons.mjs';
import {armFeedback,beep,readImageText,cancelTextReading,printedCodes} from './assist.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let mode='real',view='inventory',query='',stream,timer,db,cameraSession=0,expectedRevision=0,storageError='',lastCommitError='',scannerLink;const device=localStorage.mtDevice||crypto.randomUUID();localStorage.mtDevice=device;
const seed=()=>({version:1,products:[['Ketchup de casa','TEST-001','Casa','Botella · 400 g',6,2,'A','1','01','🍅'],['Crema de casa','TEST-002','Casa','Envase · 250 ml',2,3,'A','1','02','🥛'],['Filtro de aceite (ficticio)','FIC-101','DemoParts','Rosca M20 · motor 1.6',12,4,'B','2','01','⚙'],['Pastillas de freno (ficticias)','FIC-102','DemoParts','Delanteras · sedan',0,2,'B','3','02','🔧']].map(([name,code,brand,spec,qty,min,shelf,level,box,emoji])=>({id:crypto.randomUUID(),name,code,brand,spec,qty,min,shelf,level,box,emoji})),events:[]});
const key=()=>`mi-torno-v1-${mode}`;
function revisionOf(raw){try{const n=JSON.parse(raw)?.revision;return Number.isSafeInteger(n)&&n>=0?n:0}catch{return 0}}
const cloud=new CloudInventory();let busy=false,ready=false,loadSequence=0;
async function load(){
const ticket=++loadSequence,currentMode=mode;ready=false;storageError='';try{const status=await cloud.get('status');if(ticket!==loadSequence)return;if(!status.configured)throw Error('El guardado en la nube aún no está configurado.');if(!status.authenticated){login();return}const snapshot=await cloud.load(currentMode);if(ticket!==loadSequence)return;db=snapshot;expectedRevision=db.revision;ready=true;render();refreshActor()}
catch(e){if(ticket!==loadSequence)return;storageError=e.message;db??={version:1,products:[],events:[],revision:0};render();$('#content').innerHTML='<div class="panel"><h2>No se pudo abrir el inventario compartido</h2><p>'+esc(e.message)+'</p><button id="retryCloud">Reintentar conexión</button></div>';$('#retryCloud').onclick=load}}
function login(){ready=false;db={version:1,products:[],events:[],revision:0};render();$('#content').innerHTML='<section class="panel"><h2>Mi Torno Gestión · Beta 1P</h2><p>Ingresa la misma clave del taller en tu teléfono, tablet y computadora para abrir el inventario compartido.</p><form id="cloudLogin"><label>Clave del taller<input id="cloudCode" type="password" required autocomplete="current-password"></label><button class="primary">Abrir inventario</button><p id="loginError" role="status"></p></form></section>';$('#cloudLogin').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{await cloud.call('login',{code:$('#cloudCode').value.trim()});await load()}catch(error){$('#loginError').textContent=error.message;button.disabled=false}}}
async function commit(fn){if(busy){toast('Espera a que termine el guardado.');return false}const old=structuredClone(db);lastCommitError='';busy=true;try{if(!ready||storageError)throw Error(storageError||'Abre el inventario compartido primero.');fn();db=await cloud.save(db,mode,expectedRevision);expectedRevision=db.revision;render();document.dispatchEvent?.(new CustomEvent('inventory-updated'));return true}catch(e){db=old;lastCommitError=e.message;toast(e.message);if(e.status===401)login();return false}finally{busy=false}}
function actorName(){return localStorage.getItem('mtOperator')?.trim()||'Sin identificar'}
function refreshActor(){if($('#operatorLabel'))$('#operatorLabel').textContent=actorName();if($('#versionLabel'))$('#versionLabel').textContent='Beta 1P';}
async function restoreInventory(data){if(busy||!ready)throw Error('Abre el inventario y espera a que termine el guardado.');busy=true;try{db=await cloud.replace(data,mode,expectedRevision);expectedRevision=db.revision;storageError='';render();document.dispatchEvent(new CustomEvent('inventory-updated'))}finally{busy=false}}

function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4000)}
function modal(html){stop();$('#dialogBody').innerHTML=html;if(!$('#modal').open)$('#modal').showModal()}
function close(){stop();$('#modal').close()}function stop(){cameraSession++;cancelTextReading();clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null}$('#close').onclick=close;$('#modal').addEventListener('cancel',stop);$('#modal').addEventListener('close',()=>{if(ready&&!busy)load()});
function render(){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#title').textContent=({inventory:'Inventario',history:'Movimientos',alerts:'Reposición',settings:'Datos y ajustes'})[view];$('#banner').textContent=storageError||'Inventario real · Guardado compartido en la nube.';$('#banner').classList.toggle('error-banner',!!storageError);const low=db.products.filter(p=>p.qty<=p.min);$('#stats').innerHTML=[['Productos registrados',db.products.length],['Unidades disponibles',db.products.reduce((a,p)=>a+p.qty,0)],['Productos por reponer',low.length]].map(([t,n])=>`<div class="stat"><span>${t}</span><b>${n}</b></div>`).join('');
if(view==='settings'){settings();return}if(view==='alerts'){restockView(db.products,detail);return}if(view==='history'){$('#content').innerHTML=db.events.length?db.events.slice(0,250).map(e=>`<div class="history-row"><div><b>${esc(e.name)}</b><small>${esc(({in:'Entrada',out:'Salida',count:'Conteo',create:'Alta',location:'Ubicación',photo:'Foto'})[e.type]||e.type)} · ${esc(e.note)}<br>${esc(e.actor||'Este dispositivo')} · ${new Date(e.at).toLocaleString('es-SV')}</small></div><div>${e.before} → <b>${e.after}</b></div></div>`).join(''):'<div class="empty">Todavía no hay movimientos. Registra tu primera entrada.</div>';return}
$('#content').innerHTML=`<div class="toolbar"><input id="search" placeholder="Buscar nombre, código, marca, medidas o ubicación…" aria-label="Buscar productos" value="${esc(query)}"><span>${view==='alerts'?'En mínimo o por debajo':'CATÁLOGO DE PRODUCTOS'}</span></div><div class="grid" id="grid"></div>`;$('#search').oninput=e=>{query=e.target.value;cards()};cards();}
function cards(){const ps=search(db.products,query).filter(p=>view!=='alerts'||p.qty<=p.min);$('#grid').innerHTML=ps.map(p=>`<article class="card"><div class="visual">${p.photo?`<img loading="lazy" decoding="async" src="${esc(p.photo)}" alt="${esc(p.name)}">`:(p.emoji?esc(p.emoji):icon('box'))}</div><div class="card-body"><span class="code">${esc(p.code)}</span><h3>${esc(p.name)}</h3><div class="meta">${esc(p.brand)} · ${esc(p.spec)}</div><div class="stock"><div><strong>${p.qty}</strong> <small>uds.</small></div><span class="badge ${p.qty<=p.min?'low':''}">${p.qty<=p.min?'Stock bajo':'Disponible'}</span></div><p class="meta">${icon('location')} Estante ${esc(p.shelf||'—')} / Nivel ${esc(p.level||'—')} / Caja ${esc(p.box||'—')}</p><button data-id="${p.id}">Ver ficha y registrar</button></div></article>`).join('')||'<div class="empty">No hay productos para mostrar.</div>';document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>detail(b.dataset.id))}
function detail(id,preferred='in'){
const p=db.products.find(p=>p.id===id);if(!p){toast('Producto no encontrado');return}const openedQty=p.qty;
modal(`<div class="detail-title"><div><span class="badge">REAL</span><span class="code"> ${esc(p.code)}</span><h2>${esc(p.name)}</h2><p>${esc(p.brand)} · ${esc(p.spec)}</p></div>${p.photo?'<img class="detail-photo" alt="'+esc(p.name)+'" src="'+esc(p.photo)+'">':''}</div><div class="detail-stock"><span>Disponible<strong>${p.qty}<small> unidades</small></strong></span><span>Mínimo <b>${p.min}</b><br>${icon('location')} ${esc([p.shelf,p.level,p.box].filter(Boolean).join(' / ')||'Sin ubicación')}</span></div>
<form id="movement"><input type="hidden" name="type" value="${['in','out','count'].includes(preferred)?preferred:'in'}"><div class="movement-tabs"><button type="button" data-move-type="in">Entrada</button><button type="button" data-move-type="out">Salida</button><button type="button" data-move-type="count">Conteo</button></div>
<label id="amountLabel">Cantidad</label><div class="quantity-control"><button type="button" id="amountMinus" aria-label="Quitar una unidad">−</button><input aria-labelledby="amountLabel" name="amount" type="number" inputmode="numeric" step="1" min="1" required value="1"><button type="button" id="amountPlus" aria-label="Sumar una unidad">＋</button></div><div class="quantity-shortcuts"><button type="button" data-add="1">+1</button><button type="button" data-add="5">+5</button><button type="button" data-add="10">+10</button></div>
<div id="difference" class="movement-preview" role="status"></div><label>Motivo<select name="reason"><option value="Compra / recepción">Compra / recepción</option><option value="Trabajo de taller">Trabajo de taller</option><option value="Venta">Venta</option><option value="Devolución">Devolución</option><option value="Daño / pérdida">Daño / pérdida</option><option value="Conteo físico">Conteo físico</option><option value="Otro">Otro</option></select></label><label>Nota / referencia<input name="note" maxlength="180" placeholder="Trabajo, proveedor o motivo de diferencia"></label><button type="button" id="movementActor" class="actor-button">Registra: ${esc(actorName())}</button><label class="check-label"><input id="scanNext" type="checkbox"> Escanear siguiente al confirmar</label><button id="confirmMovement" class="primary">Confirmar movimiento</button></form><button id="edit">Editar datos, foto o ubicación</button><button type="button" id="deleteProduct">Eliminar producto</button>`);
const f=$('#movement'),type=f.elements.namedItem('type'),amount=f.elements.namedItem('amount'),note=f.elements.namedItem('note'),reason=f.elements.namedItem('reason');
function diff(){const count=type.value==='count',n=Number(amount.value),after=count?n:p.qty+(type.value==='in'?n:-n);amount.min=count?'0':'1';note.required=count;$('#amountLabel').textContent=count?'Total contado físicamente':'Unidades a '+(type.value==='in'?'agregar':'retirar');$('#difference').textContent=Number.isSafeInteger(n)?p.qty+' → '+after+' unidades'+(count?' · Diferencia '+(after-p.qty):''):'Escribe una cantidad entera';const valid=Number.isSafeInteger(n)&&n>=(count?0:1)&&after>=0&&Number.isSafeInteger(after);$('#confirmMovement').disabled=!valid;$('#difference').classList.toggle('invalid',!valid);document.querySelectorAll('[data-move-type]').forEach(button=>{const active=button.dataset.moveType===type.value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))})}
document.querySelectorAll('[data-move-type]').forEach(button=>button.onclick=()=>{type.value=button.dataset.moveType;reason.value=type.value==='in'?'Compra / recepción':type.value==='out'?'Trabajo de taller':'Conteo físico';diff()});$('#amountMinus').onclick=()=>{amount.value=Math.max(type.value==='count'?0:1,Number(amount.value||0)-1);diff()};$('#amountPlus').onclick=()=>{amount.value=Number(amount.value||0)+1;diff()};document.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{amount.value=Number(amount.value||0)+Number(button.dataset.add);diff()});f.oninput=diff;reason.value=type.value==='out'?'Trabajo de taller':type.value==='count'?'Conteo físico':'Compra / recepción';diff();
$('#movementActor').onclick=()=>{const name=prompt('Nombre de quien registra este movimiento',localStorage.getItem('mtOperator')||'');if(name!==null){localStorage.setItem('mtOperator',name.trim().slice(0,50));$('#movementActor').textContent='Registra: '+actorName();refreshActor()}};
f.onsubmit=async e=>{e.preventDefault();if(type.value==='count'&&!note.value.trim()){toast('Escribe el motivo del conteo.');return}if(type.value==='count'&&db.products.find(x=>x.id===id)?.qty!==openedQty){toast('La cantidad cambió mientras contabas. Reabre la ficha para revisar.');return}const operation=type.value,next=$('#scanNext').checked,text=reason.value+(note.value.trim()?': '+note.value.trim():'');if(await commit(()=>{move(db,id,operation,Number(amount.value),text,device);db.events[0].actor=actorName()})){close();toast('Movimiento guardado · '+p.name);if(next)scannerLink.startScan(operation)}};$('#edit').onclick=()=>productForm(p);$('#deleteProduct').onclick=async()=>{if(!confirm('¿Eliminar '+p.name+' del inventario? Su historial de movimientos se conservará.'))return;if(await commit(()=>{db.products=db.products.filter(item=>item.id!==id);db.events.unshift({id:crypto.randomUUID(),productId:id,name:p.name,type:'delete',before:p.qty,after:0,note:'Producto eliminado del catálogo',actor:actorName(),at:new Date().toISOString(),device})})){close();toast('Producto eliminado del inventario')}};
}
function field(label,name,value='',type='text'){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${['name','code'].includes(name)?'required':''} ${type==='number'?'min="0" step="1"':''} maxlength="160"></label>`}
function productForm(p={},code=''){
modal(`<h2>${p.id?'Editar producto':'Nuevo producto'}</h2><form id="product"><div class="fields">
${field('Nombre','name',p.name)}${field('Código único','code',p.code||code)}
<div class="wide"><button type="button" id="scanProductCode">${icon('scan')} Escanear código</button><p id="productCodeStatus" role="status"></p></div>
${field('Marca','brand',p.brand)}${field('Medidas / características','spec',p.spec)}${!p.id?field('Cantidad inicial','qty',0,'number'):''}${field('Stock mínimo','min',p.min||0,'number')}${field('Stock deseado (opcional)','target',p.target||0,'number')}
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
photoId++;photoBusy=false;saveButton.disabled=false;catalogPhoto=image;catalogResult={original:image,cleaned:''};$('#photoEditor').replaceChildren();showCatalog();$('#useOriginal').hidden=true;$('#useWhite').hidden=true;$('#catalogStatus').textContent=p.id?'Foto recibida y guardada como portada. Puedes retocarla si lo necesitas.':'Foto incorporada a la ficha. Completa los datos y pulsa Crear producto para verla en el inventario.';
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
form.onsubmit=async e=>{
e.preventDefault();if(photoBusy){toast('Espera a que termine la foto.');return}if($('#photoEditor').childElementCount){toast('Aplica o cancela el retoque antes de guardar.');return}
const data=Object.fromEntries(new FormData(form)),duplicate=db.products.find(x=>x.code.trim().toLowerCase()===data.code.trim().toLowerCase()&&x.id!==p.id);
if(duplicate){const body=$('#dialogBody'),savedNodes=Array.from(body.childNodes);modal('<h2>Este código ya existe</h2><p>'+esc(duplicate.name)+' · '+duplicate.qty+' unidades. Abre su ficha para sumar, corregir o cambiar ubicación.</p><button id="existing" class="primary">Abrir ficha existente</button><button id="backDraft" type="button">Volver al producto</button>');$('#existing').onclick=()=>detail(duplicate.id);$('#backDraft').onclick=()=>{stop();$('#dialogBody').replaceChildren(...savedNodes)};return}
const qty=p.id?p.qty:Number(data.qty),min=Number(data.min),target=Number(data.target||0);if(!Number.isSafeInteger(qty)||qty<0||!Number.isSafeInteger(min)||min<0||!Number.isSafeInteger(target)||target<0){toast('Cantidades enteras, cero o mayores');return}
if(target>0&&target<=min){toast('El stock deseado debe superar el mínimo, o déjalo en cero para calcularlo.');return}
if(await commit(()=>{const next={...p,id:p.id||crypto.randomUUID(),name:data.name.trim(),code:data.code.trim(),brand:data.brand.trim(),spec:data.spec.trim(),shelf:data.shelf.trim(),level:data.level.trim(),box:data.box.trim(),qty,min,target,photo:catalogPhoto};if(!next.name||!next.code)throw Error('Completa nombre y código');if(p.id)db.products=db.products.map(x=>x.id===p.id?next:x);else db.products.push(next);db.events.unshift({id:crypto.randomUUID(),productId:next.id,name:next.name,type:p.id?'location':'create',before:p.qty||0,after:qty,note:p.id?'Ficha actualizada':'Cantidad inicial',actor:actorName(),at:new Date().toISOString(),device,sync:'local'})})){close();toast('Producto guardado')}
};
}
async function saveIncomingPhoto({code,image}){
if(typeof image!=='string'||image.length>500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image))throw Error('La foto recibida no es válida.');
const p=db.products.find(item=>item.code.trim().toLowerCase()===String(code).trim().toLowerCase());if(!p)return false;
if(!await commit(()=>{p.photo=image;db.events.unshift({id:crypto.randomUUID(),productId:p.id,name:p.name,type:'photo',before:p.qty,after:p.qty,note:'Portada recibida del teléfono',at:new Date().toISOString(),device,sync:'local'})}))throw Error('No se pudo guardar la foto en la nube.');
return true;
}
function identify(code,preferred='in'){stop();const p=db.products.find(p=>p.code.toLowerCase()===code.trim().toLowerCase());if(p)detail(p.id,preferred);else{modal(`<h2>Código sin registrar</h2><p>${esc(code)} no está en este inventario. No se consultan catálogos externos.</p><button id="newCode" class="primary">Crear producto con este código</button>`);$('#newCode').onclick=()=>productForm({},code)}}
async function scanner(options={}){
const qrOnly=options.qrOnly===true;
armFeedback();
const onCode=typeof options.onCode==='function'?options.onCode:identify;
modal(qrOnly?`<h2>Vincular como escáner</h2><p>Apunta al QR que muestra la tablet o computadora en Vincular escáner.</p><div class="scan-window qr-window"><video id="camera" autoplay playsinline muted></video><div class="scan-guide" aria-hidden="true"></div></div><p id="cameraStatus" role="status">Solicitando acceso a la cámara…</p><button id="retryCamera" type="button">Reintentar cámara</button><button id="testBeep" type="button">Probar pitido</button><form id="manualCode"><label>También puedes pegar el enlace de vinculación<input name="code" required placeholder="Pega el enlace de la pantalla receptora" autocomplete="off"></label><button class="primary">Vincular con este enlace</button></form>`:`<h2>Escanear producto</h2><p>Apunta al código de barras. La lectura abre la ficha; no suma existencias automáticamente.</p><div class="scan-window"><video id="camera" autoplay playsinline muted></video><div class="scan-guide" aria-hidden="true"></div></div><p class="scan-tip">Alinea el código dentro del recuadro</p><p id="cameraStatus" role="status">Solicitando acceso a la cámara…</p><button id="retryCamera" type="button">Reintentar cámara</button> <button id="testBeep" type="button">${icon('volume')} Probar pitido</button><form id="manualCode"><label>Código de barras o impreso<input name="code" required placeholder="Escribe el código si no se puede leer"></label><button class="primary">Buscar código</button></form><label class="code-photo-label">${icon('camera')} Fotografiar código impreso<input type="file" id="printedCodePhoto" accept="image/*" capture="environment"></label><p id="printedCodeStatus" role="status"></p><div id="printedCodeReview"></div><p>Puedes escanear barras, leer los números impresos en una foto o escribirlos manualmente.</p>`);
if(typeof options.onBack==='function'){const back=document.createElement('button');back.type='button';back.textContent='← Volver al producto';back.onclick=()=>{stop();options.onBack()};$('#dialogBody').prepend(back)}
const session=cameraSession,video=$('#camera'),status=$('#cameraStatus');
const active=()=>session===cameraSession&&$('#modal').open&&$('#camera')===video;
$('#retryCamera').onclick=()=>scanner(options);
$('#testBeep').onclick=()=>{armFeedback();beep()};
let accepted=false;
const accept=value=>{value=String(value||'').trim();if(!value||accepted)return;accepted=true;beep();stop();onCode(value)};
$('#manualCode').onsubmit=e=>{e.preventDefault();armFeedback();accept(e.target.code.value)};
const printedPhoto=$('#printedCodePhoto');if(printedPhoto)printedPhoto.onchange=async e=>{
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
if(qrOnly){status.textContent='Preparando lector QR…';detector=await makeQRDetector()}else{
try{
if(!('BarcodeDetector' in window))throw Error();
const formats=await window.BarcodeDetector.getSupportedFormats();
if(!formats.length)throw Error();
detector=new window.BarcodeDetector({formats});
}catch{
if(active())status.textContent='Cámara activa. Este navegador no ofrece lectura automática de barras; fotografía los números del código o escríbelos abajo.';
return;
}}
if(!active())return;
status.textContent=qrOnly?'Cámara activa. Centra el QR de la pantalla receptora.':'Cámara activa. Coloca el código dentro de la imagen.';
async function tick(){
if(!active()||!stream)return;
try{const canvas=document.createElement('canvas');const ratio=qrOnly?1:2.4,vw=video.videoWidth,vh=video.videoHeight;if(!vw||!vh)throw Error();const w=Math.min(vw,vh*ratio),h=w/ratio;canvas.width=Math.min(w,1280);canvas.height=canvas.width/ratio;canvas.getContext('2d').drawImage(video,(vw-w)/2,(vh-h)/2,w,h,0,0,canvas.width,canvas.height);const results=await detector.detect(canvas);if(!active())return;if(results.length){accept(results[0].rawValue);return}}catch{if(active())status.textContent='Cámara activa. No se pudo leer el código; acércalo con buena luz o escríbelo abajo.'}
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
function settings(){dataSettings({getDB:()=>db,exportData:()=>cloud.backup(mode),getLegacy:()=>localStorage.getItem(key()),getMode:()=>mode,restoreData:restoreInventory,getRecovery:()=>localStorage.getItem(key()+':previous'),modal,close,toast,device,onActor:refreshActor})}

document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;query='';render()});$('#add').onclick=()=>{if(ready)productForm();else toast('Abre el inventario compartido primero.')};$('#scan').onclick=()=>scannerLink.startScan('in');
for(const [selector,name,label] of [['#scan','scan','Escanear'],['#add','plus','Nuevo producto'],['[data-view="inventory"]','box','Inventario'],['[data-view="history"]','history','Movimientos'],['[data-view="alerts"]','alert','Reposición'],['[data-view="settings"]','settings','Datos y ajustes']])$(selector).innerHTML=icon(name)+'<span>'+label+'</span>';
$('#quickIn').onclick=()=>scannerLink.startScan('in');$('#quickOut').onclick=()=>scannerLink.startScan('out');$('#guideButton').onclick=()=>showGuide(modal);
window.addEventListener('storage',event=>{if(event.key!==key())return;if(!$('#modal').open)load();else toast('Cambió el inventario en otra pestaña. Cierra la ficha y actualiza antes de guardar.')});
let installPrompt;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#installApp').hidden=false});$('#installApp').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('#installApp').hidden=true}};
load();scannerLink=installScannerLink({modal,scanner,identify,toast,armFeedback,beep,icon,getSharedInventory:()=>sharedSnapshot(db,mode),onSharedMove:async request=>{let result;if(!await commit(()=>{result=applySharedMove(db,mode,request,device)}))throw Error(lastCommitError||'No se pudo registrar el movimiento. Actualiza el inventario.');return sharedSnapshot(db,mode)},savePhoto:saveIncomingPhoto,reviewPhoto:photo=>{const p=db.products.find(item=>item.code.toLowerCase()===photo.code.toLowerCase());productForm(p||{},photo.code);$('#product').dispatchEvent(new CustomEvent('remote-catalog-photo',{detail:photo}))}});setInterval(async()=>{if(!ready||busy||$('#modal').open||view==='settings')return;try{const meta=await cloud.get('meta',{environment:mode});if(meta.revision!==expectedRevision)await load()}catch{}},5000);if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
