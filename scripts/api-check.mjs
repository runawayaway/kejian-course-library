import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const base=(process.env.API_TEST_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const key=randomBytes(32).toString('hex'),other=randomBytes(32).toString('hex');
const created=[];
async function call(path,method='GET',data=null,token=key){
 const form=data instanceof FormData;
 const response=await fetch(base+path,{method,headers:{'X-Device-Key':token,Origin:'http://localhost:4173',Connection:'close',...(!form&&data?{'Content-Type':'application/json'}:{})},body:data?(form?data:JSON.stringify(data)):undefined});
 return {response,data:await response.json()};
}
try{
 const health=await fetch(base+'/api/health');assert.equal(health.status,200);
 let result=await call('/api/entries','POST',{kind:'course',name:'接口验证课程-'+Date.now(),content:'自动测试，完成后删除。'});
 assert.equal(result.response.status,201,JSON.stringify(result.data));const course=result.data.record;created.push(course.id);
 result=await call('/api/entries/'+course.id,'PUT',{name:course.name,content:'其他设备不应覆盖',version:1},other);assert.equal(result.response.status,403);
 result=await call('/api/entries/'+course.id,'PUT',{name:course.name,content:'正常修改课程简介',version:1});assert.equal(result.response.status,200);
 result=await call('/api/entries/'+course.id,'PUT',{name:course.name,content:'旧版本不应覆盖',version:1});assert.equal(result.response.status,409);
 result=await call('/api/entries','POST',{kind:'experience',courseId:course.id,content:'这条经验直接由 API 保存，不经过 GitHub。',teacher:'测试教师',semester:'2026秋季'});
 assert.equal(result.response.status,201);const experience=result.data.record;created.push(experience.id);
 result=await call('/api/entries/'+experience.id,'PUT',{courseId:course.id,content:'修改后的经验',teacher:'测试教师',semester:'2026秋季',version:1});assert.equal(result.response.status,200);
 const bytes=new TextEncoder().encode('%PDF-1.4\n% Course platform integration test\n%%EOF');
 let form=new FormData();form.set('metadata',JSON.stringify({kind:'resource',courseId:course.id,content:'测试 PDF'}));form.set('file',new Blob([bytes],{type:'application/pdf'}),'测试资料.pdf');
 result=await call('/api/entries','POST',form);assert.equal(result.response.status,201,JSON.stringify(result.data));const resource=result.data.record;created.push(resource.id);
 const download=await fetch(base+resource.downloadPath);assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),bytes);
 form=new FormData();form.set('metadata',JSON.stringify({kind:'resource',courseId:course.id}));form.set('file',new Blob(['bad']),'malware.exe');result=await call('/api/entries','POST',form);assert.equal(result.response.status,400);
 form=new FormData();form.set('metadata',JSON.stringify({kind:'resource',courseId:course.id}));form.set('file',new Blob(['not a PDF']),'fake.pdf');result=await call('/api/entries','POST',form);assert.equal(result.response.status,400);
 const list=await call('/api/contributions');assert.ok(list.data.records.some(r=>r.id===experience.id&&r.body==='修改后的经验'&&r.editable));
 const stranger=await call('/api/contributions','GET',null,other);assert.ok(stranger.data.records.some(r=>r.id===experience.id&&!r.editable));
 assert.ok(stranger.data.resources.some(r=>r.id===resource.id));
 const crossOrigin=await fetch(base+'/api/entries',{method:'POST',headers:{Origin:'https://unrelated.example','X-Device-Key':key,'Content-Type':'application/json'},body:JSON.stringify({kind:'course',name:'invalid'})});assert.equal(crossOrigin.status,403);
 console.log('PASS: persistent course/experience creation and editing, owner isolation, version conflicts, real file upload/download, file type validation and cross-device reading.');
}finally{
 for(const id of created.reverse()){const result=await call('/api/entries/'+id,'DELETE');assert.equal(result.response.status,200,'测试内容清理失败：'+id);}
}
