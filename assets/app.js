(() => {
  'use strict';
  const config=window.SITE_CONFIG, community=window.CourseCommunity;
  const baseCourses=window.COURSES;
  let courses=[...baseCourses], contributions={courses:[],records:[],resources:[]};
  const main=document.querySelector('main'),dialog=document.querySelector('dialog'),form=document.querySelector('#contribution-form');
  const repository=/^[\w.-]+\/[\w.-]+$/.test(config.repository)?config.repository:'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let bookmarks=new Set();
  try{const saved=JSON.parse(localStorage.getItem('kejian-bookmarks'));if(Array.isArray(saved))bookmarks=new Set(saved.filter(v=>typeof v==='string'));}catch{}
  let query='',filter='all',currentCourse=null,activeTab='resources',mode='experience',toastTimer;
  let busy=false,loaded=false,lastCheck=0,signature='',syncStatus='正在同步…',pending=null;
  try{pending=JSON.parse(sessionStorage.getItem('kejian-pending-contribution'));}catch{}
  if(pending&&(!['course','experience','resource'].includes(pending.kind)||typeof pending.name!=='string'||typeof pending.content!=='string'||!Number.isFinite(pending.startedAt)||Date.now()-pending.startedAt>3600000))pending=null;

  function toast(text){const box=document.querySelector('#toast');box.textContent=text;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),4500);}
  function updateCount(){document.querySelector('#bookmark-count').textContent=courses.filter(c=>bookmarks.has(c.id)).length;}
  function syncBar(){return `<div class="sync-bar"><span role="status">${esc(syncStatus)}</span><button class="text-button" data-refresh ${busy?'disabled':''}>${busy?'同步中…':'刷新'}</button></div>`;}
  function updateSync(){document.querySelectorAll('.sync-bar').forEach(bar=>{bar.querySelector('[role="status"]').textContent=syncStatus;const b=bar.querySelector('button');b.disabled=busy;b.textContent=busy?'同步中…':'刷新';});}
  function saveButton(c){return `<button class="save ${bookmarks.has(c.id)?'saved':''}" data-save="${c.id}" aria-label="${bookmarks.has(c.id)?'取消收藏':'收藏'}${esc(c.name)}" aria-pressed="${bookmarks.has(c.id)}">${bookmarks.has(c.id)?'★':'☆'}</button>`;}
  function card(c){return `<article class="course-card"><div class="card-top"><span class="course-icon ${esc(c.color||'green')}" aria-hidden="true">${esc(c.icon||'＋')}</span>${saveButton(c)}</div><h2><a href="#/course/${c.id}">${esc(c.name)}</a></h2><p>${esc(c.description.slice(0,100))}</p><div class="card-foot"><span>${c.resources.length} 份资料</span><span>${c.experiences.length} 条经验</span>${c.sourceType==='community'?`<span class="tag">同学新增${c.accepted?'':' · 待核实'}</span>`:''}</div></article>`;}
  function home(savedOnly=false){
    currentCourse=null;
    main.innerHTML=`<div class="container"><section class="library-heading"><div><h1>${savedOnly?'我的收藏':'课程资料与修课经验'}</h1><p>${savedOnly?'收藏保存在当前浏览器。':'找资料、看经验，也把你的收获留下。'}</p></div></section><div class="searchbox"><span aria-hidden="true">⌕</span><input id="course-search" type="search" aria-label="搜索课程" placeholder="搜索课程或资料关键词" value="${esc(query)}"></div><div class="library-tools"><div class="filters" aria-label="课程筛选">${[['all','全部'],['resources','有资料'],['experiences','有经验'],['community','同学新增']].map(([id,label])=>`<button class="filter ${filter===id?'selected':''}" data-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div>${syncBar()}</div><div id="course-results" aria-live="polite"></div><div class="add-course-note"><span>还没有这门课？</span><button class="text-button" data-add-course>添加课程</button></div></div>`;
    document.querySelector('#course-search').oninput=e=>{query=e.target.value;renderResults(savedOnly);};
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});renderResults(savedOnly);});
    renderResults(savedOnly);
  }
  function renderResults(savedOnly=false){
    const needle=query.trim().toLocaleLowerCase();
    const found=courses.filter(c=>(!savedOnly||bookmarks.has(c.id))&&(!needle||[c.name,c.college,...(c.tags||[]),...c.resources.map(r=>r.title)].join(' ').toLocaleLowerCase().includes(needle))&&(filter==='all'||filter==='resources'&&c.resources.length||filter==='experiences'&&c.experiences.length||filter==='community'&&c.sourceType==='community'));
    document.querySelector('#course-results').innerHTML=`<p class="result-count">${found.length} 门课程</p>${found.length?`<div class="course-grid">${found.map(card).join('')}</div>`:`<div class="empty"><h2>${savedOnly?'这里还没有课程':'没有找到这门课'}</h2><p>${savedOnly?'在课程卡片上点星标即可收藏。':'换个关键词，或把这门课加进来。'}</p><button class="button secondary" data-add-course>添加课程</button></div>`}`;
  }
  function experienceCard(e,c){
    const context=[e.teacher&&e.teacher!=='未注明'?'教师：'+e.teacher:'',e.semester&&e.semester!=='未注明'?'学期：'+e.semester:''].filter(Boolean).join(' · ');
    return `<article class="reading-panel community-record"><div class="record-heading"><h2>${esc(e.title||'修课经验')}</h2><span class="tag">${esc(e.status||'已收录')}</span></div><p class="experience-meta">${esc(e.author)}${context?' · '+esc(context):''}</p><p class="preserve-lines">${esc(e.body)}</p><div class="record-actions">${e.url?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer" class="text-button">查看来源</a><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer" class="text-button" data-edit>修改原文</a>`:''}${e.accepted===false?'<span class="muted">待核实，暂不作为确定的授课要求。</span>':''}</div></article>`;
  }
  function resourceCard(r){
    return `<article class="reading-panel resource-row"><span class="file-icon">${esc(r.format)}</span><div class="resource-body"><h2><a href="${esc(r.url)}" ${r.local?'download':'target="_blank" rel="noopener noreferrer"'}>${esc(r.title)} ↗</a></h2><p class="muted">${esc(r.source)}${r.accepted===false?' · 待核实':''}</p><div class="resource-bottom">${(r.variants||[]).map(v=>`<a class="text-button" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.format)} 格式 ↗</a>`).join('')}${r.issueUrl?`<a class="text-button" href="${esc(r.issueUrl)}" target="_blank" rel="noopener noreferrer" data-edit>修改分享</a>`:''}</div></div></article>`;
  }
  function detail(c){
    currentCourse=c;
    main.innerHTML=`<div class="container"><div class="breadcrumbs"><a href="#/">全部课程</a><span>/</span><span>${esc(c.name)}</span></div><section class="detail-hero"><div class="section-title"><div><h1>${esc(c.name)}</h1><p>${esc(c.college&&c.college!=='学院未注明'?c.college:'同学新增课程')}${c.sourceType==='community'&&!c.accepted?' · 待核实':''}</p></div>${saveButton(c)}</div><p class="detail-description">${esc(c.description)}</p><div class="detail-actions"><button class="button primary" data-write>写经验</button><button class="button secondary" data-share>分享资料链接</button>${c.issueUrl?`<a class="text-button" href="${esc(c.issueUrl)}" target="_blank" rel="noopener noreferrer" data-edit>修改课程</a>`:''}</div></section><div class="detail-tools"><div class="tabbar" role="tablist" aria-label="课程内容">${[['resources','资料 '+c.resources.length],['experiences','经验与考核 '+c.experiences.length]].map(([id,label])=>`<button id="tab-${id}" data-tab="${id}" role="tab" aria-selected="${activeTab===id}" aria-controls="detail-content" tabindex="${activeTab===id?0:-1}" class="${activeTab===id?'active':''}">${label}</button>`).join('')}</div>${syncBar()}</div><section id="detail-content" role="tabpanel" aria-labelledby="tab-${activeTab}"></section></div>`;
    document.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>setTab(b.dataset.tab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const id=e.key==='Home'?'resources':e.key==='End'?'experiences':b.dataset.tab==='resources'?'experiences':'resources';setTab(id);document.querySelector('#tab-'+id).focus();};});
    renderTab(c);
  }
  function setTab(id){activeTab=id;document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===id;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});document.querySelector('#detail-content')?.setAttribute('aria-labelledby','tab-'+id);if(currentCourse)renderTab(currentCourse);}
  function renderTab(c){
    const target=document.querySelector('#detail-content');
    if(activeTab==='resources')target.innerHTML=c.resources.length?c.resources.map(resourceCard).join(''):'<div class="empty"><h2>还没有资料</h2><p>有好用的笔记或公开资源？分享一个链接吧。</p><button class="button secondary" data-share>分享资料链接</button></div>';
    else target.innerHTML=`<p class="section-note">学习方法、授课方式和考核经历都在这里。请核对记录中的教师和学期。</p>${c.experiences.length?c.experiences.map(e=>experienceCard(e,c)).join(''):'<div class="empty"><h2>还没有修课经验</h2><p>写几句建议，就能帮助下一位同学。</p><button class="button secondary" data-write>写经验</button></div>'}`;
  }
  function route(){
    const raw=location.hash.slice(1)||'/',[path,params='']=raw.split('?');
    const id=path.startsWith('/course/')?path.slice(8):null;
    const c=id?courses.find(c=>c.id===id):null;
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(path==='/bookmarks'?'bookmarks':'home')));
    if(c){const tab=new URLSearchParams(params).get('tab');activeTab=['resources','experiences'].includes(tab)?tab:c.experiences.length?'experiences':'resources';detail(c);}
    else if(id){currentCourse=null;main.innerHTML=`<div class="container"><div class="empty"><h1>${loaded?'暂时找不到这门课':'正在加载课程…'}</h1><p>${loaded?'课程可能已更名或暂不可见。':'正在读取同学添加的课程。'}</p><a class="button secondary" href="#/">返回课程列表</a></div></div>`;}
    else home(path==='/bookmarks');
    document.title=(c?c.name:path==='/bookmarks'?'我的收藏':'课程资料与修课经验')+' · 课间';updateCount();window.scrollTo(0,0);
  }
  function rebuild(data){
    contributions={courses:Array.isArray(data.courses)?data.courses:[],records:Array.isArray(data.records)?data.records:[],resources:Array.isArray(data.resources)?data.resources:[]};
    const next=JSON.stringify(contributions),changed=next!==signature,firstMerge=signature==='';signature=next;
    courses=[...baseCourses,...contributions.courses].map(c=>({...c,resources:[...(c.resources||[]),...contributions.resources.filter(r=>r.courseId===c.id)],experiences:[...(c.experiences||[]),...contributions.records.filter(r=>r.courseId===c.id)]}));
    window.COURSES=courses;
    if(changed){
      if(currentCourse){const updated=courses.find(c=>c.id===currentCourse.id);if(updated){if(firstMerge&&!location.hash.includes('?tab=')&&updated.experiences.length)activeTab='experiences';detail(updated);}else route();}
      else if(document.querySelector('#course-results'))renderResults(location.hash==='#/bookmarks');
      else if(location.hash.startsWith('#/course/'))route();
    }
    updateCount();updateSync();updateCourseOptions();confirmPending();
  }
  function confirmPending(){
    if(!pending)return;
    const p=pending;
    const c=courses.find(c=>community.nameKey(c.name)===community.nameKey(p.name));
    if(!c)return;
    const found=p.kind==='course'?(c.number>(p.afterIssue||0)?c:null):p.kind==='experience'?c.experiences.find(e=>e.number>(p.afterIssue||0)&&e.body.trim()===p.content.trim()&&e.teacher===(p.teacher||'未注明')&&e.semester===(p.semester||'未注明')):c.resources.find(r=>r.number>(p.afterIssue||0)&&r.issueUrl&&r.url===p.url);
    if(!found)return;
    pending=null;try{sessionStorage.removeItem('kejian-pending-contribution');}catch{}dialog.close();
    const tab=p.kind==='resource'?'resources':'experiences';
    const next='#/course/'+c.id+'?tab='+tab;
    if(location.hash===next){currentCourse=c;activeTab=tab;detail(c);}else location.hash=next;
    toast(p.kind==='course'?'课程已添加，大家都能找到。':'内容已同步到课程页。');
  }
  async function refreshCommunity({automatic=false}={}){
    if(busy||!repository)return;
    if(automatic&&Date.now()-lastCheck<(pending?3000:20000))return;
    busy=true;lastCheck=Date.now();syncStatus='正在同步…';updateSync();
    try{
      const issues=[];
      for(let page=1;page<=10;page++){
        const response=await fetch(`https://api.github.com/repos/${repository}/issues?state=all&per_page=100&page=${page}`,{headers:{Accept:'application/vnd.github+json'},cache:'no-store',signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error(String(response.status));
        const batch=await response.json();if(!Array.isArray(batch))throw new Error('Invalid response');issues.push(...batch);
        if(batch.length<100)break;if(page===10)throw new Error('Too many issues');
      }
      busy=false;loaded=true;syncStatus='已同步';rebuild(community.collectIssues(issues,baseCourses,repository));
    }catch{busy=false;loaded=true;syncStatus='同步暂不可用，已保留现有内容';updateSync();if(!document.querySelector('#course-results')&&!currentCourse)route();}
  }
  async function loadCommunity(){
    try{const response=await fetch('data/community.json',{cache:'no-store'});if(!response.ok)throw new Error('No snapshot');const data=await response.json();if(data.repository!==repository)throw new Error('Wrong repository');loaded=true;syncStatus='已加载，正在同步…';rebuild(data);}catch{}
    await refreshCommunity();
  }
  function updateCourseOptions(){const selected=form.elements.course.value;form.elements.course.innerHTML='<option value="">选择课程</option>'+courses.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');if(courses.some(c=>c.id===selected))form.elements.course.value=selected;}
  function openForm(kind){
    mode=kind;form.reset();document.querySelector('#submission-result').hidden=true;
    document.querySelector('#dialog-title').textContent=kind==='course'?'添加课程':kind==='resource'?'分享资料链接':'写经验';
    document.querySelector('#course-select-field').hidden=kind==='course';form.elements.course.required=kind!=='course';
    document.querySelector('#course-name-field').hidden=kind!=='course';form.elements.name.required=kind==='course';
    document.querySelector('#url-field').hidden=kind!=='resource';form.elements.url.required=kind==='resource';
    document.querySelector('#context-fields').hidden=kind!=='experience';document.querySelector('#context-fields').open=false;
    form.elements.content.required=kind==='experience';form.elements.content.minLength=kind==='experience'?2:0;
    document.querySelector('#content-label').textContent=kind==='experience'?'你的经验':kind==='course'?'课程简介（可选）':'一句说明（可选）';
    form.elements.content.placeholder=kind==='experience'?'学习建议、授课方式、考核要求，都可以写在这里。':kind==='course'?'这门课学什么？也可以先留空。':'这份资料有什么用？';
    updateCourseOptions();form.elements.course.value=currentCourse?.id||'';dialog.showModal();
  }
  function draft(){
    const c=courses.find(c=>c.id===form.elements.course.value);
    const name=(mode==='course'?form.elements.name.value:c?.name||'').trim(),content=form.elements.content.value.trim(),teacher=form.elements.teacher.value.trim(),semester=form.elements.semester.value.trim();
    const label=mode==='course'?'新增课程':mode==='resource'?'分享资料':'修课经验';
    const title=mode==='course'?name:content.split('\n')[0].slice(0,60)||(mode==='resource'?name+'资料链接':'修课经验');
    const url=mode==='resource'?community.safeLink(form.elements.url.value):'';
    return {name,content,teacher,semester,url,kind:mode,courseId:c?.id||'',startedAt:Date.now(),title:`[${label}] ${title}`,body:`## ${label}\n\n- 课程：${name}\n${c?'- 课程ID：'+c.id+'\n':''}${mode==='experience'?'- 授课教师：'+(teacher||'未注明')+'\n- 学期：'+(semester||'未注明')+'\n- 内容包含：学习方法、授课与考核\n':''}${mode==='resource'?'- 链接：'+url+'\n':''}\n## 具体内容\n\n${content}\n`};
  }
  form.onsubmit=e=>{
    e.preventDefault();if(!form.reportValidity())return;
    const d=draft();
    if(!d.name){toast('请先选择或填写课程');return;}
    if(mode==='course'){
      const existing=courses.find(c=>community.nameKey(c.name)===community.nameKey(d.name));
      if(existing){dialog.close();location.hash='/course/'+existing.id;toast('这门课已经在列表里，可以直接补充内容。');return;}
    }
    if(mode==='resource'&&!d.url){form.elements.url.setCustomValidity('请填写有效的 http 或 https 资料链接');form.elements.url.reportValidity();return;}
    pending={...d,afterIssue:Math.max(0,...contributions.courses.map(c=>c.number),...contributions.records.map(r=>r.number),...contributions.resources.map(r=>r.number))};try{sessionStorage.setItem('kejian-pending-contribution',JSON.stringify(pending));}catch{}
    const href=`https://github.com/${repository}/issues/new?title=${encodeURIComponent(d.title)}&body=${encodeURIComponent(d.body)}`;
    const result=document.querySelector('#submission-result');result.hidden=false;result.innerHTML=`<p>已打开 GitHub。确认提交后切回这里，会自动同步。</p><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">没有打开？点击继续 ↗</a>`;
    window.open(href,'_blank','noopener,noreferrer');
  };
  form.elements.url.oninput=()=>form.elements.url.setCustomValidity('');
  document.querySelector('#close-dialog').onclick=()=>dialog.close();
  dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}};
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-add-course],[data-write],[data-share],[data-refresh],[data-save],[data-edit]');if(!b)return;
    if(b.hasAttribute('data-add-course'))openForm('course');
    if(b.hasAttribute('data-write'))openForm('experience');
    if(b.hasAttribute('data-share'))openForm('resource');
    if(b.hasAttribute('data-refresh'))refreshCommunity();
    if(b.hasAttribute('data-edit'))toast('在 GitHub 原记录右上角「⋯ → Edit」修改并保存，切回后自动同步。需作者或维护者权限。');
    if(b.hasAttribute('data-save')){
      const id=b.dataset.save;bookmarks.has(id)?bookmarks.delete(id):bookmarks.add(id);
      try{localStorage.setItem('kejian-bookmarks',JSON.stringify([...bookmarks]));}catch{}
      updateCount();if(currentCourse)detail(currentCourse);else renderResults(location.hash==='#/bookmarks');
    }
  });
  function checkOnReturn(){if(document.visibilityState==='visible')refreshCommunity({automatic:true});}
  window.addEventListener('focus',checkOnReturn);document.addEventListener('visibilitychange',checkOnReturn);window.addEventListener('online',checkOnReturn);setInterval(checkOnReturn,120000);
  window.addEventListener('hashchange',route);route();loadCommunity();
})();
