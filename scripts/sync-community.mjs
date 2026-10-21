import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import '../assets/community.js';
const context = {window:{}};
vm.runInNewContext(await readFile(new URL('../data/courses.js',import.meta.url),'utf8'),context);
const {COURSES:courses,SITE_CONFIG:config}=context.window;
const gh=process.env.GH_BIN||(process.platform==='win32'?'C:/Program Files/GitHub CLI/gh.exe':'gh');
const issues=[];
for(let page=1;;page++){
  const batch=JSON.parse(execFileSync(gh,['api',`repos/${config.repository}/issues?state=all&per_page=100&page=${page}`],{encoding:'utf8',maxBuffer:16e6}));
  issues.push(...batch);if(batch.length<100)break;
}
const contributions=globalThis.CourseCommunity.collectIssues(issues,courses,config.repository);
const snapshot={repository:config.repository,syncedAt:new Date().toISOString(),...contributions};
await writeFile(new URL('../data/community.json',import.meta.url),JSON.stringify(snapshot,null,2)+'\n');
console.log(`已同步 ${contributions.courses.length} 门同学新增课程、${contributions.records.length} 条经验、${contributions.resources.length} 份分享链接。`);
