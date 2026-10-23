import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(await readFile(new URL('../assets/runtime-config.js',import.meta.url),'utf8'),context);
const base=context.window.API_BASE;
const response=await fetch(base+'/api/contributions');if(!response.ok)throw new Error('无法导出服务器数据：'+response.status);
const data=await response.json();data.syncedAt=new Date().toISOString();data.baseEditable=false;data.admin=false;data.reports=[];
for(const list of [data.courses,data.records,data.resources,data.courseOverrides])for(const row of list||[])row.editable=false;
await writeFile(new URL('../data/community.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`已备份 ${data.courses.length} 门新增课程、${data.records.length} 条经验和 ${data.resources.length} 份上传资料的公开记录。文件本体保存在文件存储中。`);
