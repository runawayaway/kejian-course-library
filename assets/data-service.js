/* Public API; only browser-owned editing credentials live on this device. */
(() => {
  const base=String(window.API_BASE||'').replace(/\/$/,'');
  let device='';
  try{device=localStorage.getItem('kejian-device-key')||'';}catch{}
  if(!/^[a-f0-9]{64}$/.test(device)){device=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('kejian-device-key',device);}catch{}}
  let admin='';try{admin=localStorage.getItem('kejian-admin-key')||'';}catch{}
  const headers=()=>({'X-Device-Key':device,...(admin?{'X-Admin-Key':admin}:{})});
  async function request(path,options={}){
    if(!base)throw new Error('保存服务尚未连接，请稍后再试');
    const response=await fetch(base+path,{...options,headers:{...headers(),...(options.headers||{})},cache:'no-store',signal:AbortSignal.timeout(options.body instanceof FormData?600000:20000)});
    const result=await response.json().catch(()=>({error:'服务器返回了无效响应'}));
    if(!response.ok)throw Object.assign(new Error(result.error||'保存失败，请稍后再试'),{status:response.status});return result;
  }
  window.CourseService={
    base, get:()=>request('/api/contributions'),
    save:async(data,file)=>{const {id,...metadata}=data;let body,extra={};if(data.kind==='resource'){body=new FormData();body.set('metadata',JSON.stringify(metadata));if(file)body.set('file',file);}else{body=JSON.stringify(metadata);extra={'Content-Type':'application/json'};}return request('/api/entries'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body,headers:extra});},
    setAdminKey:key=>{admin=key;try{key?localStorage.setItem('kejian-admin-key',key):localStorage.removeItem('kejian-admin-key');}catch{}},
    fileUrl:path=>base+path
  };
})();
