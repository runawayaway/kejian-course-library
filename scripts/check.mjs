import vm from 'node:vm';
import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const context={window:{}};
vm.runInNewContext(await readFile(new URL('../data/courses.js',import.meta.url),'utf8'),context);
const {COURSES:courses,SITE_CONFIG:config}=context.window;
assert.ok(courses.length>=3,'至少应有三门示例课程');
assert.equal(new Set(courses.map(c=>c.id)).size,courses.length,'课程 ID 不能重复');
assert.ok(!config.repository||/^[\w.-]+\/[\w.-]+$/.test(config.repository),'repository 应为 owner/repo');
for(const c of courses){
  for(const field of ['id','name','college','category','semester','teacher','overview'])assert.ok(c[field],`${c.id} 缺少 ${field}`);
  assert.match(c.id,/^[a-z0-9-]+$/);
  for(const r of c.resources){
    assert.ok(r.source && r.permission,`${r.title} 必须标注来源与权限`);
    if(r.local){assert.match(r.url,/^materials\/[a-z0-9-]+\.md$/);await access(new URL('../'+r.url,import.meta.url));}
    else assert.equal(new URL(r.url).protocol,'https:');
  }
}
console.log(`校验通过：${courses.length} 门课程，${courses.reduce((n,c)=>n+c.resources.length,0)} 份资料，所有本地文件存在。`);
