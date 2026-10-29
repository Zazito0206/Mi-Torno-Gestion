import {createHmac,createHash,timingSafeEqual,randomBytes} from 'node:crypto';
export const COOKIE='mt_cloud_session';
export function sameSecret(a,b){return timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest())}
export function createSession(secret,now=Date.now()){const payload=Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+7*86400,nonce:randomBytes(12).toString('hex')})).toString('base64url'),signature=createHmac('sha256',secret).update(payload).digest('base64url');return payload+'.'+signature}
export function validSession(token,secret,now=Date.now()){try{const [payload,signature,...extra]=String(token||'').split('.');if(extra.length||!payload||!signature)return false;const expected=createHmac('sha256',secret).update(payload).digest('base64url');if(!sameSecret(signature,expected))return false;const data=JSON.parse(Buffer.from(payload,'base64url').toString());return Number.isSafeInteger(data.exp)&&data.exp>Math.floor(now/1000)}catch{return false}}
export function sessionCookie(token){return COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800'}
export function readCookie(header){return String(header||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''}
export function allowedOrigin(req){try{return new URL(req.headers.origin).host===req.headers.host}catch{return false}}
export function loginBucket(ip,secret){return createHmac('sha256',secret).update(String(ip||'unknown')).digest('hex')}
