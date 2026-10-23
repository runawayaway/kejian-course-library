import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pool} from './runtime.mjs';
export async function migrate(){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(18769001)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const directory=new URL('./migrations/',import.meta.url);
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()){
   const sql=await readFile(new URL(file,directory),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
   const previous=await client.query('SELECT checksum FROM schema_migrations WHERE version=$1',[file]);
   if(previous.rows.length){if(previous.rows[0].checksum!==checksum)throw Error('Applied migration changed: '+file);continue;}
   await client.query(sql);await client.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)',[file,checksum]);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
