/* Apply before the first paint, then follow the system until manually changed. */
(() => {
  const system=matchMedia('(prefers-color-scheme: dark)');
  let preference=null;
  try{const saved=localStorage.getItem('kejian-theme');if(['light','dark'].includes(saved))preference=saved;}catch{}
  function apply(){
    const dark=(preference||(system.matches?'dark':'light'))==='dark';
    document.documentElement.dataset.theme=dark?'dark':'light';
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#101923':'#203c59';
    const button=document.querySelector('#theme-toggle');
    if(button){button.setAttribute('aria-pressed',String(dark));button.title=dark?'切换到日间模式':'切换到夜间模式';button.querySelector('[data-theme-icon]').textContent=dark?'☀':'☾';button.querySelector('[data-theme-label]').textContent=dark?'日间':'夜间';}
  }
  apply();system.addEventListener('change',()=>{if(!preference)apply();});
  window.addEventListener('storage',event=>{if(event.key==='kejian-theme'){preference=['light','dark'].includes(event.newValue)?event.newValue:null;apply();}});
  document.addEventListener('DOMContentLoaded',()=>{apply();document.querySelector('#theme-toggle').onclick=()=>{preference=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('kejian-theme',preference);}catch{}apply();};});
})();
