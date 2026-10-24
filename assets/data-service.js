/* Public API; only browser-owned editing credentials live on this device. */
(() => {
  const base=String(window.API_BASE||'').replace(/\/$/,'');
  let device='';
  try{device=localStorage.getItem('kejian-device-key')||'';}catch{}
  if(!/^[a-f0-9]{64}$/.test(device)){device=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('kejian-device-key',device);}catch{}}
  let identityVersion=0;
  let admin='';try{admin=localStorage.getItem('kejian-admin-key')||'';}catch{}
  const headers=()=>({'X-Device-Key':device,...(admin?{'X-Admin-Key':admin}:{})});
  async function request(path,options={}){
    if(!base)throw new Error('保存服务尚未连接，请稍后再试');
    const response=await fetch(base+path,{...options,headers:{...headers(),...(options.headers||{})},cache:'no-store',signal:AbortSignal.timeout(options.body instanceof FormData?600000:20000)});
    const result=await response.json().catch(()=>({error:'服务器返回了无效响应'}));
    if(!response.ok)throw Object.assign(new Error(result.error||'保存失败，请稍后再试'),{status:response.status});return result;
  }
  function upload(path,method,body,onProgress){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open(method,base+path);xhr.responseType='json';xhr.timeout=600000;for(const [key,value]of Object.entries(headers()))xhr.setRequestHeader(key,value);xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress?.(Math.round(e.loaded/e.total*100));};xhr.onload=()=>{const result=xhr.response||{};if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(Object.assign(new Error(result.error||'上传失败，请稍后重试'),{status:xhr.status}));};xhr.onerror=()=>reject(new Error('网络连接中断，文件已保留在表单中，可以重试'));xhr.ontimeout=()=>reject(new Error('上传超时，文件已保留在表单中，可以重试'));xhr.send(body);});}
  window.CourseService={
    base, get:()=>request('/api/contributions'),hasAdmin:()=>!!admin,identityVersion:()=>identityVersion,
    saveDocument:data=>request('/api/documents',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),
    save:async(data,file,onProgress)=>{const {id,...metadata}=data;let body,extra={};const path='/api/entries'+(id?'/'+encodeURIComponent(id):'');if(data.kind==='resource'){body=new FormData();body.set('metadata',JSON.stringify(metadata));if(file)body.set('file',file);return upload(path,id?'PUT':'POST',body,onProgress);}else{body=JSON.stringify(metadata);extra={'Content-Type':'application/json'};}return request(path,{method:id?'PUT':'POST',body,headers:extra});},
    setAdminKey:key=>{identityVersion++;admin=key;try{key?localStorage.setItem('kejian-admin-key',key):localStorage.removeItem('kejian-admin-key');}catch{}},
    remove:id=>request('/api/entries/'+encodeURIComponent(id),{method:'DELETE'}),
    moderate:(id,data)=>request('/api/moderation/'+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),
    recoveryCode:()=>device,
    restore:async key=>{if(!/^[a-f0-9]{64}$/.test(key))throw new Error('恢复码应为 64 位字符，请检查是否复制完整');const data=await request('/api/contributions',{headers:{'X-Device-Key':key,'X-Admin-Key':''}});if(![...data.courses,...data.records,...data.resources].some(r=>r.editable))throw new Error('未找到这个恢复码对应的投稿，请检查恢复码');identityVersion++;device=key;admin='';try{localStorage.setItem('kejian-device-key',key);localStorage.removeItem('kejian-admin-key');}catch{}return data;},
    fileUrl:path=>base+path
  };
})();
