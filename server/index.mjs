import http from 'node:http';
import busboy from 'busboy';
import {mkdtemp,unlink,rmdir,readFile} from 'node:fs/promises';
import {createWriteStream,createReadStream,statSync,openSync,readSync,closeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import {handle} from './domain.mjs';
import {pool} from './runtime.mjs';
import {migrate} from './migrate.mjs';
class DiskFile extends File{
 constructor(filename,diskPath,type){super([],filename,{type});this.diskPath=diskPath;}
 get size(){return statSync(this.diskPath).size;}
 stream(){return Readable.toWeb(createReadStream(this.diskPath));}
 slice(start=0,end=this.size,type=''){const size=this.size,from=start<0?Math.max(size+start,0):Math.min(start,size),to=end<0?Math.max(size+end,0):Math.min(end,size),buffer=Buffer.alloc(Math.max(0,to-from));const fd=openSync(this.diskPath,'r');try{const n=readSync(fd,buffer,0,buffer.length,from);return new Blob([buffer.subarray(0,n)],{type});}finally{closeSync(fd);}}
}
class IncomingRequest extends Request{
 constructor(req,url){super(url,{method:req.method,headers:req.headers});this.incoming=req;this.temporary=[];this.directory=null;}
 async json(){const chunks=[];let size=0;for await(const c of this.incoming){size+=c.length;if(size>128*1024)throw Object.assign(Error('请求内容过长'),{status:413});chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('请求格式无效'),{status:400});}}
 async formData(){
  this.directory=await mkdtemp(path.join(tmpdir(),'kejian-upload-'));const values=new Map(),jobs=[];
  await new Promise((resolve,reject)=>{
   let parser;try{parser=busboy({headers:this.incoming.headers,defParamCharset:'utf8',limits:{files:1,fields:8,fieldSize:64*1024,parts:10}});}catch{return reject(Object.assign(Error('上传格式无效'),{status:400}));}
   parser.on('field',(name,value,info)=>{if(info.valueTruncated)parser.destroy(Object.assign(Error('资料说明过长'),{status:413}));else values.set(name,value);});
   parser.on('file',(name,stream,info)=>{const target=path.join(this.directory,randomUUID());this.temporary.push(target);const job=pipeline(stream,createWriteStream(target,{flags:'wx'})).then(()=>values.set(name,new DiskFile(info.filename,target,info.mimeType)));jobs.push(job);job.catch(e=>parser.destroy(e));});
   for(const event of ['filesLimit','fieldsLimit','partsLimit'])parser.on(event,()=>parser.destroy(Object.assign(Error('一次只能上传一个文件'),{status:400})));
   parser.on('error',reject);parser.on('finish',resolve);this.incoming.on('aborted',()=>parser.destroy(Error('Upload aborted')));this.incoming.pipe(parser);
  });await Promise.all(jobs);return {get:name=>values.get(name)??null};
 }
 async cleanup(){for(const file of this.temporary)await unlink(file).catch(()=>{});if(this.directory)await rmdir(this.directory).catch(()=>{});}
}
if(!process.env.DATABASE_URL||!process.env.ADMIN_KEY)throw Error('DATABASE_URL and ADMIN_KEY must be configured');
await migrate();
const server=http.createServer(async(req,res)=>{
 let request;
 try{
  const protocol=req.headers['x-forwarded-proto']==='https'?'https':'http';
  request=new IncomingRequest(req,protocol+'://'+(req.headers.host||'localhost')+req.url);
  const response=await handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));
  if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();
 }catch(error){if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'服务暂不可用，请稍后重试'}));}else res.destroy();console.error('Request failed:',error.code||error.name);}
 finally{await request?.cleanup();}
});
server.requestTimeout=10*60*1000;server.headersTimeout=30000;server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('KeJian API ready on port '+(process.env.PORT||3000)));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(async()=>{await pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});
