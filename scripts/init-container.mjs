import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
try{await writeFile(new URL('../.env.container',import.meta.url),'DB_PASSWORD='+randomBytes(24).toString('hex')+'\nCONTAINER_ADMIN_KEY='+randomBytes(32).toString('hex')+'\nWEB_PORT=8096\n',{flag:'wx',mode:0o600});console.log('已生成 .env.container，包含独立容器版的私有配置。请保留此文件，不要公开提交。');}
catch(error){if(error.code==='EEXIST')console.log('.env.container 已存在，保留原配置。');else throw error;}
