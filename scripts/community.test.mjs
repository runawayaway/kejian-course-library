import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/community.js';
const parse=globalThis.CourseCommunity.parseIssue;
const courses=[{id:'operating-systems',name:'操作系统'}];
const repo='runawayaway/kejian-course-library';
const issue={number:1,title:'[修课经验] 课程所占学分',body:'## 修课经验\n\n- 课程：操作系统\n- 学期：2025-2026春季\n- 授课教师：李长悦\n\n## 具体内容\n\n课程成绩组成为平时：期末为3:7，三学分\n\n---\n由课间投稿表单生成，待维护者审核。\n',user:{login:'runawayaway'},author_association:'OWNER',labels:[],created_at:'2026-10-20T12:26:23Z'};
test('legacy experience preserves exact teacher, semester, assessment and source',()=>{
 const record=parse(issue,courses,repo);
 assert.equal(record.body,'课程成绩组成为平时：期末为3:7，三学分');
 assert.equal(record.teacher,'李长悦');assert.equal(record.semester,'2025-2026春季');
 assert.equal(record.accepted,true);assert.equal(record.teaching,true);assert.equal(record.url,'https://github.com/'+repo+'/issues/1');
});
test('unreviewed and learning-only contributions do not become teaching references',()=>{
 const record=parse({...issue,author_association:'NONE',body:issue.body.replace('- 学期：','- 内容包含：学习方法\n- 学期：')},courses,repo);
 assert.equal(record.accepted,false);assert.equal(record.teaching,false);
 assert.equal(parse({...issue,author_association:'NONE',labels:[{name:'已收录'}]},courses,repo).accepted,true);
});
test('reject unrelated, hidden and malformed contributions',()=>{
 assert.equal(parse({...issue,pull_request:{}},courses,repo),null);
 assert.equal(parse({...issue,labels:[{name:'不予收录'}]},courses,repo),null);
 assert.equal(parse({...issue,body:issue.body.replace('操作系统','未知课程')},courses,repo),null);
 assert.equal(parse({...issue,title:'[分享资料] 文件',body:'## 资料'},courses,repo),null);
});
