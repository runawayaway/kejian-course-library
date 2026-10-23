import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
for(const name of (await readdir(new URL('../server/',import.meta.url))).filter(n=>n.endsWith('.mjs'))){const file=fileURLToPath(new URL('../server/'+name,import.meta.url));const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit',windowsHide:true});if(result.status!==0)process.exit(result.status||1);}
console.log('独立后端语法校验通过。');
