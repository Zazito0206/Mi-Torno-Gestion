import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url))),port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),p=path.resolve(root,'.'+pathname);if(p!==root&&!p.startsWith(root+path.sep))throw Error();const target=p===root?path.join(root,'index.html'):p,content=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(content)}catch{res.writeHead(404);res.end('No encontrado')}}).listen(port,'127.0.0.1',()=>console.log('Mi Torno Gestión Beta 1: http://localhost:'+port));
