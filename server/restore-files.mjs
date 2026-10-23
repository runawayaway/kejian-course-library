/* Accept only the object layout produced by this application, inside its volume. */
import {readdir,lstat,unlink,rmdir,mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {tmpdir} from 'node:os';
const root=path.resolve(process.env.UPLOAD_DIR||'/var/lib/kejian/files');
if(root!=='/var/lib/kejian/files')throw Error('Restore target must be the configured container volume');
const temporary=await mkdtemp(path.join(tmpdir(),'kejian-restore-')),archive=path.join(temporary,'uploads.tar.gz');
try{
 await pipeline(process.stdin,createWriteStream(archive,{flags:'wx'}));
 const listed=spawnSync('tar',['-tzf',archive],{encoding:'utf8'});if(listed.status!==0)throw Error('Invalid upload archive');
 const entries=listed.stdout.trim().split(/\r?\n/);if(entries.some(e=>!/^\.(?:\/)?$/.test(e)&&!/^\.\/uploads\/$/.test(e)&&!/^\.\/uploads\/[a-f0-9-]{36}$/.test(e)))throw Error('Archive contains unexpected file paths');
 const detailed=spawnSync('tar',['-tvzf',archive],{encoding:'utf8'});if(detailed.status!==0||detailed.stdout.split(/\r?\n/).some(line=>line&&!['-','d'].includes(line[0])))throw Error('Links are not allowed in upload backups');
 for(const entry of await readdir(root,{withFileTypes:true})){
  if(entry.name!=='uploads'||!entry.isDirectory()||entry.isSymbolicLink())throw Error('Unexpected object layout; restore stopped');
  const folder=path.join(root,entry.name);
  for(const item of await readdir(folder,{withFileTypes:true})){if(!item.isFile()||item.isSymbolicLink()||!/^[a-f0-9-]{36}(\.partial)?$/.test(item.name))throw Error('Unexpected stored file');await unlink(path.join(folder,item.name));}
  await rmdir(folder);
 }
 const unpacked=spawnSync('tar',['-xzf',archive,'-C',root]);if(unpacked.status!==0)throw Error('Unable to restore uploaded objects');
}finally{await unlink(archive).catch(()=>{});await rmdir(temporary).catch(()=>{});}
