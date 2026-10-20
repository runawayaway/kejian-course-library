import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.md':'text/markdown; charset=utf-8','.json':'application/json; charset=utf-8'};
const server = http.createServer(async (req,res)=>{
  try {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const relative = pathname.replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(root, relative);
    const resolvedRelative = path.relative(root, target).replaceAll('\\', '/');
    const allowed = resolvedRelative === 'index.html' || /^(assets|data|materials)\/(?!.*(?:^|\/)\.)/.test(resolvedRelative);
    if(!target.startsWith(root) || !allowed || !(await stat(target)).isFile()){res.writeHead(404);res.end('Not found');return;}
    const data = await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404);res.end('Not found');}
});
const port=Number(process.env.PORT||4173);
server.listen(port,'127.0.0.1',()=>console.log(`课间已启动：http://localhost:${port}`));
