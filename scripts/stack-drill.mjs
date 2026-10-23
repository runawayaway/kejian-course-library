import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const base=process.env.STACK_TEST_URL||'http://localhost:8096',project=process.env.COMPOSE_PROJECT_NAME||'kejian-course-lab';
if(project!=='kejian-course-lab')throw Error('This destructive recovery drill only runs against the isolated kejian-course-lab project');
const env={...process.env,COMPOSE_PROJECT_NAME:project},key=randomBytes(32).toString('hex'),headers={'X-Device-Key':key};
const name='容器持久化演练-'+Date.now(),directory=path.resolve('artifacts/stack-backup-'+Date.now()),checks=[];
let course,resource;
function run(command,args){const r=spawnSync(command,args,{stdio:'inherit',env,windowsHide:true});assert.equal(r.status,0,'演练命令失败');}
async function ready(){for(let n=0;n<60;n++){try{const r=await fetch(base+'/api/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('API failed to recover');}
async function listing(){const r=await fetch(base+'/api/contributions',{headers});assert.ok(r.ok);return r.json();}
try{
 let r=await fetch(base+'/api/entries',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({kind:'course',name})});assert.equal(r.status,201);course=(await r.json()).record;
 const bytes=Buffer.from('容器重建及备份恢复后，文件字节应保持一致。'.repeat(100));const form=new FormData();form.set('metadata',JSON.stringify({kind:'resource',courseId:course.id,category:'实验参考'}));form.set('file',new Blob([bytes]),'恢复演练.txt');
 r=await fetch(base+'/api/entries',{method:'POST',headers,body:form});assert.equal(r.status,201);resource=(await r.json()).record;
 run(process.execPath,['scripts/stack-backup.mjs','backup',directory]);await ready();checks.push('一致性数据库与文件备份完成');
 run('docker',['compose','--env-file','.env.container','up','-d','--force-recreate','--wait']);await ready();
 assert.ok((await listing()).courses.some(c=>c.id===course.id&&c.editable));assert.deepEqual(Buffer.from(await(await fetch(base+resource.downloadPath)).arrayBuffer()),bytes);checks.push('删除并重建三个容器后，投稿权限、课程和文件保留');
 assert.ok((await fetch(base+'/api/entries/'+resource.id,{method:'DELETE',headers})).ok);assert.ok((await fetch(base+'/api/entries/'+course.id,{method:'DELETE',headers})).ok);assert.ok(!(await listing()).courses.some(c=>c.id===course.id));
 run(process.execPath,['scripts/stack-backup.mjs','restore',directory,'--replace']);await ready();
 assert.ok((await listing()).courses.some(c=>c.id===course.id&&c.editable));assert.deepEqual(Buffer.from(await(await fetch(base+resource.downloadPath)).arrayBuffer()),bytes);checks.push('删除演练数据后，从备份恢复课程、修改权限和完整文件');
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/stack-drill-result.json',JSON.stringify({project,url:base,backup:directory,passedAt:new Date().toISOString(),checks},null,2));console.log('PASS:',checks.join('；'));
}finally{if(resource)await fetch(base+'/api/entries/'+resource.id,{method:'DELETE',headers});if(course)await fetch(base+'/api/entries/'+course.id,{method:'DELETE',headers});}
