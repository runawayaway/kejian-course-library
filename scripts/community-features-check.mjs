import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const base=process.env.API_TEST_URL||'http://127.0.0.1:8788',key=randomBytes(32).toString('hex'),other=randomBytes(32).toString('hex');
const admin=process.env.ADMIN_KEY||'local-test-admin-key',created=[];
async function call(path,method='GET',data=null,identity=key,isAdmin=false){const form=data instanceof FormData;const r=await fetch(base+path,{method,headers:{'X-Device-Key':identity,...(isAdmin?{'X-Admin-Key':admin}:{}),...(data&&!form?{'Content-Type':'application/json'}:{})},body:data?(form?data:JSON.stringify(data)):undefined});return {status:r.status,data:await r.json()};}
try{
 let r=await call('/api/entries','POST',{kind:'course',name:'社区功能验证-'+Date.now()});assert.equal(r.status,201);const course=r.data.record;created.push(course.id);
 const form=new FormData();form.set('metadata',JSON.stringify({kind:'resource',courseId:course.id,category:'学习笔记',teacher:'测试教师',semester:'2026秋',content:'分类测试'}));form.set('file',new Blob(['# 课程笔记']),'测试笔记.md');
 r=await call('/api/entries','POST',form);assert.equal(r.status,201,JSON.stringify(r.data));const resource=r.data.record;created.push(resource.id);assert.equal(resource.category,'学习笔记');assert.equal(resource.teacher,'测试教师');assert.equal(resource.semester,'2026秋');
 r=await call('/api/entries/'+course.id,'DELETE');assert.equal(r.status,409,'非空课程不可删除');
 r=await call('/api/entries/'+resource.id,'DELETE',null,other);assert.equal(r.status,403);
 r=await call('/api/entries','POST',{kind:'report',courseId:course.id,targetId:resource.id,targetTitle:resource.title,content:'资料年份需要维护者核实'});assert.equal(r.status,201);const report=r.data.record;created.push(report.id);
 const publicList=(await call('/api/contributions','GET',null,other)).data;assert.equal(publicList.reports.length,0);assert.ok(!publicList.courses.some(c=>c.id===report.id));assert.ok(publicList.resources.some(c=>c.id===resource.id&&!c.editable));
 r=await call('/api/moderation/'+report.id,'POST',{version:1,status:'resolved'});assert.equal(r.status,403);
 const adminList=(await call('/api/contributions','GET',null,key,true)).data;assert.ok(adminList.admin);assert.ok(adminList.reports.some(c=>c.id===report.id&&c.reason==='资料年份需要维护者核实'));
 r=await call('/api/moderation/'+report.id,'POST',{version:1,status:'resolved'},key,true);assert.equal(r.status,200,JSON.stringify(r.data));
 r=await call('/api/moderation/'+resource.id,'POST',{version:1,accepted:true},key,true);assert.equal(r.status,200);
 const verified=(await call('/api/contributions')).data;assert.ok(verified.resources.some(c=>c.id===resource.id&&c.accepted&&c.version===2));
 r=await call('/api/moderation/'+resource.id,'POST',{version:1,accepted:false},key,true);assert.equal(r.status,409);
 r=await call('/api/entries','POST',{kind:'report',courseId:'operating-systems',targetId:resource.id,targetTitle:resource.title,content:'不应该跨课程反馈'});assert.equal(r.status,400);
 console.log('PASS: persisted category/context; private feedback; admin resolution and verification; version conflicts and deletion permissions.');
}finally{for(const id of created.reverse()){const r=await call('/api/entries/'+id,'DELETE');assert.equal(r.status,200,'清理失败 '+id);}}
