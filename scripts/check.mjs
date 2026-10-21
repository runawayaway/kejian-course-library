import vm from 'node:vm';
import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const context={window:{}};
vm.runInNewContext(await readFile(new URL('../data/courses.js',import.meta.url),'utf8'),context);
const {COURSES:courses,SITE_CONFIG:config}=context.window;
assert.ok(courses.length>=3,'至少应有三门课程');
assert.equal(new Set(courses.map(c=>c.id)).size,courses.length,'课程 ID 不能重复');
assert.ok(!config.repository||/^[\w.-]+\/[\w.-]+$/.test(config.repository),'repository 应为 owner/repo');
for(const c of courses){
  for(const field of ['id','name','college','category','semester','teacher','overview'])assert.ok(c[field],`${c.id} 缺少 ${field}`);
  assert.match(c.id,/^[a-z0-9-]+$/);
  assert.equal(c.teacher,'未提供','未经核实不得生成教师信息');
  assert.equal(c.credits,null,'未经核实不得生成学分');
  for(const r of c.resources){
    assert.ok(r.source && r.permission,`${r.title} 必须标注来源与权限`);
    if(r.local){assert.match(r.url,/^materials\/[a-z0-9-]+\.md$/);await access(new URL('../'+r.url,import.meta.url));}
    else {
      const url=new URL(r.url);
      assert.equal(url.protocol,'https:');
      assert.equal(url.hostname,'github.com');
      assert.ok(url.pathname.startsWith('/'+config.sourceRepository+'/'));
      assert.ok(url.pathname.includes('/'+config.sourceRevision+'/'),'源资料链接应固定到同步版本');
      if(r.sourcePath) assert.ok(decodeURIComponent(url.pathname).endsWith('/'+r.sourcePath),'链接应与原始文件名一致');
      for(const v of r.variants||[])assert.ok(decodeURIComponent(new URL(v.url).pathname).endsWith('/'+v.sourcePath));
    }
  }
}
assert.equal(config.documentCount,courses.reduce((n,c)=>n+c.resources.filter(r=>r.format!=='DIR').length,0));
const community=JSON.parse(await readFile(new URL('../data/community.json',import.meta.url),'utf8'));
assert.equal(community.repository,config.repository);
const allCourses=[...courses,...(community.courses||[])];
assert.equal(new Set(allCourses.map(c=>c.id)).size,allCourses.length,'课程 ID 不能重复');
for(const c of community.courses||[]){assert.ok(c.name&&c.id&&c.issueUrl);assert.equal(c.issueUrl,`https://github.com/${config.repository}/issues/${c.number}`);}
assert.equal(new Set(community.records.map(r=>r.id)).size,community.records.length,'投稿 ID 不能重复');
for(const r of community.records){
  assert.ok(allCourses.some(c=>c.id===r.courseId),'投稿必须归属已收录课程');
  assert.ok(r.body&&r.teacher&&r.semester,'投稿应保留正文和教师学期字段');
  assert.equal(r.url,`https://github.com/${config.repository}/issues/${r.number}`);
}
for(const r of community.resources||[]){
  assert.ok(allCourses.some(c=>c.id===r.courseId));
  assert.ok(['http:','https:'].includes(new URL(r.url).protocol));
  assert.equal(r.issueUrl,`https://github.com/${config.repository}/issues/${r.number}`);
}
console.log(`校验通过：${courses.length} 门课程，${config.documentCount} 组文档；来源、版本与文件名一致。`);
