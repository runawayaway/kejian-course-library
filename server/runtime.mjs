import pg from 'pg';
import {readFile,mkdir,stat,unlink,rename,access} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
pg.types.setTypeParser(20,Number);
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:10000});
pool.on('error',error=>console.error('Database connection error:',error.code||'unknown'));
const sandbox={window:{}};vm.runInNewContext(await readFile(path.join(root,'data/courses.js'),'utf8'),sandbox);
export const catalog=sandbox.window.COURSES;
export const legacy=JSON.parse(await readFile(new URL('./legacy.json',import.meta.url),'utf8'));
export const filesRoot=path.resolve(process.env.UPLOAD_DIR||path.join(root,'.local-files'));
await mkdir(filesRoot,{recursive:true});await access(filesRoot);
function sqlForPostgres(sql){let n=0;return sql.replaceAll("COALESCE(json_extract(data,'$.deleted'),0)<>1","COALESCE((data::jsonb->>'deleted')::boolean,false)=false").replace('SET count=count+1','SET count=rate_limits.count+1').replace(/\?/g,()=>'$'+(++n));}
class Statement{
 constructor(sql,values=[]){this.sql=sqlForPostgres(sql);this.values=values;}
 bind(...values){const next=Object.create(Statement.prototype);next.sql=this.sql;next.values=values;return next;}
 async all(){const r=await pool.query(this.sql,this.values);return {results:r.rows};}
 async first(){return (await this.all()).results[0]||null;}
 async run(){const r=await pool.query(this.sql,this.values);return {meta:{changes:r.rowCount}};}
}
function objectPath(key){if(!/^uploads\/[a-f0-9-]{36}$/.test(key))throw Error('Invalid storage key');const target=path.resolve(filesRoot,key);if(!target.startsWith(filesRoot+path.sep))throw Error('Storage path escaped');return target;}
export const env={
 ADMIN_KEY:process.env.ADMIN_KEY||'',
 DB:{prepare:sql=>new Statement(sql)},
 BUCKET:{
  async put(key,stream){const target=objectPath(key),temporary=target+'.partial';await mkdir(path.dirname(target),{recursive:true});try{await pipeline(Readable.fromWeb(stream),createWriteStream(temporary,{flags:'wx'}));await rename(temporary,target);}catch(error){await unlink(temporary).catch(()=>{});throw error;}},
  async get(key){const target=objectPath(key);try{const s=await stat(target);return {size:s.size,body:Readable.toWeb(createReadStream(target))};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async delete(key){try{await unlink(objectPath(key));}catch(e){if(e.code!=='ENOENT')throw e;}}
 }
};
