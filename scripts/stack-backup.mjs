import {spawnSync,spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),mode=process.argv[2],input=process.argv[3];
const compose=['compose','--env-file',path.join(root,'.env.container')];
function run(args){const r=spawnSync('docker',[...compose,...args],{cwd:root,encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error((r.stderr||'Docker operation failed').trim());return r.stdout.trim();}
async function streamed(args,filename,restore=false){
 const p=spawn('docker',[...compose,...args],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});let error='';p.stderr.on('data',c=>error+=c.toString());
 const finished=new Promise((resolve,reject)=>{p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(error||'Docker stream failed')));});
 if(restore){p.stdout.resume();await Promise.all([pipeline(createReadStream(filename),p.stdin),finished]);}
 else{p.stdin.end();await Promise.all([pipeline(p.stdout,createWriteStream(filename,{flags:'wx'})),finished]);}
}
async function hash(file){const h=createHash('sha256');for await(const c of createReadStream(file))h.update(c);return h.digest('hex');}
if(!['backup','restore'].includes(mode))throw Error('用法：node scripts/stack-backup.mjs backup [目录] 或 restore 目录 --replace');
const directory=path.resolve(input||path.join(root,'backups',new Date().toISOString().replace(/[:.]/g,'-')));
if(mode==='restore'&&!process.argv.includes('--replace'))throw Error('恢复会替换本容器项目的数据。确认目标后添加 --replace；不要对其他项目运行。');
const db=path.join(directory,'database.dump'),files=path.join(directory,'uploads.tar.gz');
if(mode==='backup'){await mkdir(path.dirname(directory),{recursive:true});await mkdir(directory,{recursive:false});}
else{const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));if(manifest.format!=='kejian-backup-v1'||await hash(db)!==manifest.database||await hash(files)!==manifest.uploads)throw Error('备份校验失败，未修改运行数据');}
const project=run(['ps','-q','api']);if(!project)throw Error('请先启动要备份或恢复的容器项目');
console.log(mode==='backup'?'暂停投稿服务，生成一致性备份…':'校验通过，暂停投稿服务并恢复…');
run(['stop','api']);
try{
 if(mode==='backup'){
  await streamed(['exec','-T','db','pg_dump','-U','kejian','-d','kejian','-Fc'],db);
  await streamed(['run','--rm','--no-deps','-T','--entrypoint','tar','api','-C','/var/lib/kejian/files','-czf','-','.'],files);
  await writeFile(path.join(directory,'manifest.json'),JSON.stringify({format:'kejian-backup-v1',createdAt:new Date().toISOString(),database:await hash(db),uploads:await hash(files)},null,2));
 }else{
  await streamed(['exec','-T','db','pg_restore','-U','kejian','-d','kejian','--clean','--if-exists','--no-owner','--exit-on-error','--single-transaction'],db,true);
  await streamed(['run','--rm','--no-deps','-T','--entrypoint','node','api','server/restore-files.mjs'],files,true);
 }
 console.log((mode==='backup'?'备份完成：':'恢复完成：')+directory);
}finally{run(['start','api']);}
