import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const data=JSON.parse(await readFile(new URL('../data/learning-guides.json',import.meta.url),'utf8'));
const checked=JSON.parse(await readFile(new URL('../data/learning-source-checks.json',import.meta.url),'utf8'));
const context={window:{}};vm.runInNewContext(await readFile(new URL('../data/courses.js',import.meta.url),'utf8'),context);
const courses=context.window.COURSES,known=new Set(courses.map(c=>c.id)),covered=new Set();
assert.match(data.checkedAt,/^\d{4}-\d{2}-\d{2}$/);assert.ok(data.editorialNote.includes('不是本校'));
assert.equal(new Set(data.guides.map(g=>g.id)).size,data.guides.length);
for(const [id,source]of Object.entries(data.sources)){assert.equal(new URL(source.url).protocol,'https:');assert.ok(source.publisher&&source.language&&source.rights);assert.ok(checked.sources.some(s=>s.id===id&&s.url===source.url&&s.status===200),'来源缺少对应的入口核对记录：'+id);if(source.licenseUrl)assert.equal(new URL(source.licenseUrl).protocol,'https:');}
for(const g of data.guides){assert.match(g.id,/^[a-z0-9-]+$/);assert.ok(g.title&&g.practice&&g.steps.length>=3&&g.pitfalls.length>=2&&g.sourceIds.length);for(const id of g.courseIds){assert.ok(known.has(id),'Unknown course '+id);assert.ok(!covered.has(id),'Duplicate guide for '+id);covered.add(id);}for(const id of g.sourceIds)assert.ok(data.sources[id],'Unknown source '+id);const md=await readFile(new URL('../materials/guides/'+g.id+'.md',import.meta.url),'utf8');assert.ok(md.includes(data.editorialNote));for(const id of g.sourceIds)assert.ok(md.includes(data.sources[id].url));}
assert.equal(covered.size,courses.length,'原始课程应均有通用学习指引');
console.log(`学习资料校验通过：${data.guides.length} 份原创指引，覆盖 ${covered.size} 门原始课程，${Object.keys(data.sources).length} 个原站资料入口。`);
