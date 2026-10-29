import {imageCanvas} from './photo.mjs';
// Local label assistance. OCR assets download on demand; images stay in the browser.
export function validGTIN(code){if(!/^(?:\d{8}|\d{12,14})$/.test(code))return false;let sum=0;for(let i=code.length-2,weight=3;i>=0;i--,weight=weight===3?1:3)sum+=Number(code[i])*weight;return (10-sum%10)%10===Number(code.at(-1))}
export function printedCodes(text){const codes=[];for(const line of String(text).split(/\r?\n/)){for(const m of line.matchAll(/(?:^|\D)(\d[\d \t-]{6,24}\d)(?!\d)/g)){const value=m[1].replace(/[\s-]/g,'');if(validGTIN(value))codes.push(value)}const marked=line.match(/(?:c[oó]digo|code|sku|referencia|ref\.|parte|part\s*(?:no|number))\s*[:#.-]?\s*([A-Z0-9][A-Z0-9._/-]{2,39})/i);if(marked&&/\d/.test(marked[1]))codes.push(marked[1]);}return [...new Set(codes)].slice(0,8)}
export function labelSuggestions(text){const lines=String(text).split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean);const unwanted=/ingredientes|nutric|calor[ií]as|sodio|az[uú]car|grasa|prote[ií]na|fabricad|distribui|importad|direcci|www\.|https?:|vencim|lote|registro sanitario|conservar|porci[oó]n/i;const headings=lines.filter(s=>s.length<65&&!unwanted.test(s)&&/[a-záéíóúñ]{3}/i.test(s)&&!/^\d/.test(s));const product=lines.find(s=>!unwanted.test(s)&&/\b(ketchup|catsup|crema|salsa de tomate|filtro(?: de (?:aceite|aire|combustible))?|pastillas de freno|aceite(?: de motor)?|buj[ií]a|rodamiento|tornillo)\b/i.test(s));const explicitBrand=lines.map(s=>s.match(/^marca\s*[:.-]\s*(.{2,50})$/i)?.[1]).find(Boolean);const name=product||headings[0]||'';const brand=explicitBrand||headings.find(s=>s!==name&&s.length<=30&&!/\d|contenido|peso|neto|natural|original|premium|calidad/i.test(s))||'';const measures=[...String(text).matchAll(/\b\d+(?:[.,]\d+)?\s*(?:kg|mg|g|ml|litros?|l|mm|cm|pulgadas?|oz)\b|\bM\d+(?:[x×]\d+(?:[.,]\d+)?)?\b/gi)].map(m=>m[0]);return {name:name.slice(0,160),brand:brand.slice(0,160),spec:[...new Set(measures)].join(' · ').slice(0,160),code:printedCodes(text)[0]||''}}
let audio;
export function armFeedback(){try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;audio??=new Audio();audio.resume().catch(()=>{});}catch{}}
export async function beep(){try{if(!audio)return;if(audio.state!=='running')await audio.resume();if(audio.state!=='running')return;const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;osc.type='sine';osc.frequency.value=1450;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.4,t+.01);gain.gain.exponentialRampToValueAtTime(.001,t+.18);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.19);}catch{}}
let job=0,currentWorker;
export function cancelTextReading(){job++;if(currentWorker){currentWorker.terminate().catch(()=>{});currentWorker=null}}
export async function readImageText(file,progress=()=>{}){
cancelTextReading();const id=job;let worker,timer,stage='abrir la foto';
const active=()=>id===job;
try{
progress('Preparando foto…');const canvas=await imageCanvas(file,2000);if(!active())throw Error('Lectura cancelada.');
let barcode='';try{if(globalThis.BarcodeDetector){const d=new globalThis.BarcodeDetector();const hits=await d.detect(canvas);barcode=hits[0]?.rawValue||''}}catch{}
const run=async()=>{
stage='cargar el lector';progress('Cargando lector de etiquetas…');
const module=await import('https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js');
const {createWorker}=module.default||module;
if(typeof createWorker!=='function')throw Error('El módulo OCR no expone createWorker.');
if(!active())throw Error('Lectura cancelada.');
stage='iniciar el lector y sus idiomas';
worker=await createWorker('spa+eng',1,{logger:m=>{if(!active())return;const pct=Number.isFinite(m.progress)?' '+Math.round(m.progress*100)+'%':'';const label=m.status==='recognizing text'?'Leyendo etiqueta':m.status==='loading language traineddata'?'Preparando idiomas':'Preparando lector';progress(label+pct+'…')}});
if(!active()){await worker.terminate();throw Error('Lectura cancelada.')}
currentWorker=worker;stage='reconocer el texto';await worker.setParameters({tessedit_pageseg_mode:'11'});
const {data}=await worker.recognize(canvas);if(!active())throw Error('Lectura cancelada.');return {text:data.text||'',confidence:data.confidence,barcode};
};
const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{if(active())cancelTextReading();reject(Error('Tiempo de lectura agotado.'));},90000)});
return await Promise.race([run(),timeout]);
}catch(e){if(!active())throw Error('Lectura cancelada o tiempo agotado. Puedes reintentar sin perder las fotos.');const detail=String(e.message||e).slice(0,180);throw Error('No se pudo '+stage+'. '+detail);}
finally{clearTimeout(timer);if(worker){if(currentWorker===worker)currentWorker=null;await worker.terminate().catch(()=>{});}}
}
