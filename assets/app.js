(() => {
  'use strict';
  const config=window.SITE_CONFIG, community=window.CourseCommunity, service=window.CourseService;
  const baseCourses=window.COURSES;
  let courses=[...baseCourses], contributions={courses:[],records:[],resources:[]};
  const main=document.querySelector('main'),dialog=document.querySelector('dialog'),form=document.querySelector('#contribution-form');
  const repository=/^[\w.-]+\/[\w.-]+$/.test(config.repository)?config.repository:'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let bookmarks=new Set();
  try{const saved=JSON.parse(localStorage.getItem('kejian-bookmarks'));if(Array.isArray(saved))bookmarks=new Set(saved.filter(v=>typeof v==='string'));}catch{}
  let query='',filter='all',currentCourse=null,activeTab='resources',mode='experience',toastTimer;
  let busy=false,loaded=false,lastCheck=0,signature='',syncStatus='正在连接…',editing=null,saving=false;
  let retryTimer=null,retryCount=0;
  let contentQuery='',contentCategory='',contentTeacher='',contentSemester='';
  const resourceCategory=r=>r.category||(/复习|试卷|考试/.test(r.title)?'复习资料':/实验|作业/.test(r.kind||'')?'实验参考':/笔记/.test(r.title)?'学习笔记':'其他');
  const dateLabel=r=>(r.updatedAt||r.createdAt||'').slice(0,10);

  function toast(text){const box=document.querySelector('#toast');box.textContent=text;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),4500);}
  function updateCount(){document.querySelector('#bookmark-count').textContent=courses.filter(c=>bookmarks.has(c.id)).length;}
  function syncBar(){return `<div class="sync-bar"><span role="status">${esc(syncStatus)}</span><button class="text-button" data-refresh ${busy?'disabled':''}>${busy?'同步中…':'刷新'}</button></div>`;}
  function updateSync(){document.querySelectorAll('.sync-bar').forEach(bar=>{bar.querySelector('[role="status"]').textContent=syncStatus;const b=bar.querySelector('button');b.disabled=busy;b.textContent=busy?'同步中…':'刷新';});}
  function saveButton(c){return `<button class="save ${bookmarks.has(c.id)?'saved':''}" data-save="${c.id}" aria-label="${bookmarks.has(c.id)?'取消收藏':'收藏'}${esc(c.name)}" aria-pressed="${bookmarks.has(c.id)}">${bookmarks.has(c.id)?'★':'☆'}</button>`;}
  function card(c){return `<article class="course-card"><div class="card-top"><span class="course-icon ${esc(c.color||'green')}" aria-hidden="true">${esc(c.icon||'＋')}</span>${saveButton(c)}</div><h2><a href="#/course/${c.id}">${esc(c.name)}</a></h2><p>${esc(c.description.slice(0,100))}</p><div class="card-foot"><span>${c.resources.length} 份资料</span><span>${c.experiences.length} 条经验</span>${c.sourceType==='community'?`<span class="tag">同学新增</span>`:''}</div></article>`;}
  function home(savedOnly=false){
    currentCourse=null;
    main.innerHTML=`<div class="container"><section class="library-heading"><div><h1>${savedOnly?'我的收藏':'课程资料与修课经验'}</h1><p>${savedOnly?'收藏保存在当前浏览器。':'找资料、看经验，也把你的收获留下。'}</p></div></section><div class="searchbox"><span aria-hidden="true">⌕</span><input id="course-search" type="search" aria-label="搜索课程" placeholder="搜索课程、教师、资料或经验关键词" value="${esc(query)}"></div><div class="library-tools"><div class="filters" aria-label="课程筛选">${[['all','全部'],['resources','有资料'],['experiences','有经验'],['community','同学新增']].map(([id,label])=>`<button class="filter ${filter===id?'selected':''}" data-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div>${syncBar()}</div><div id="course-results" aria-live="polite"></div><div class="add-course-note"><span>还没有这门课？</span><button class="text-button" data-add-course>添加课程</button></div></div>`;
    document.querySelector('#course-search').oninput=e=>{query=e.target.value;renderResults(savedOnly);};
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});renderResults(savedOnly);});
    renderResults(savedOnly);
  }
  function renderResults(savedOnly=false){
    const needle=query.trim().toLocaleLowerCase();
    const found=courses.filter(c=>(!savedOnly||bookmarks.has(c.id))&&(!needle||[c.name,c.description,c.college,...(c.tags||[]),...c.resources.flatMap(r=>[r.title,r.description,r.teacher,r.semester]),...c.experiences.flatMap(r=>[r.body,r.teacher,r.semester])].join(' ').toLocaleLowerCase().includes(needle))&&(filter==='all'||filter==='resources'&&c.resources.length||filter==='experiences'&&c.experiences.length||filter==='community'&&c.sourceType==='community'));
    document.querySelector('#course-results').innerHTML=`<p class="result-count">${found.length} 门课程</p>${found.length?`<div class="course-grid">${found.map(card).join('')}</div>`:`<div class="empty"><h2>${savedOnly?'这里还没有课程':'没有找到这门课'}</h2><p>${savedOnly?'在课程卡片上点星标即可收藏。':'换个关键词，或把这门课加进来。'}</p><button class="button secondary" data-add-course>添加课程</button></div>`}`;
  }
  function experienceCard(e,c){
    const context='教师：'+(e.teacher||'未注明')+' · 学期：'+(e.semester||'未注明');
    return `<article class="reading-panel community-record"><div class="record-heading"><h2>${esc(e.title||'修课经验')}</h2><span class="tag">${esc(e.status||'已收录')}</span></div><p class="experience-meta">${esc(e.author)} · ${esc(context)}${dateLabel(e)?' · 更新于 '+esc(dateLabel(e)):''}</p><p class="preserve-lines">${esc(e.body)}</p><div class="record-actions">${e.url?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer" class="text-button">查看来源</a>`:''}${e.editable?`<button class="text-button" data-edit-record="${e.id}">修改</button>`:''}<button class="text-button" data-feedback-record="${e.id}">反馈问题</button>${e.accepted===false?'<span class="muted">待核实，请以当学期教师要求为准。</span>':''}</div></article>`;
  }
  function resourceCard(r,index){
    if(r.format==='DIR')return `<article class="reading-panel resource-row"><span class="file-icon">目录</span><div class="resource-body"><h2><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a></h2><p class="muted">${esc(r.description||'查看原始课程文件和附件。')}</p><div class="resource-bottom"><a class="text-button" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">打开源目录</a><button class="text-button" data-feedback-resource="${index}">反馈问题</button></div></div></article>`;
    return `<article class="reading-panel resource-row"><span class="file-icon">${esc(r.format)}</span><div class="resource-body"><h2><a href="${esc(r.url)}" data-preview="${index}">${esc(r.title)}</a></h2><p class="muted"><span class="tag">${esc(resourceCategory(r))}</span> ${esc(r.source)}${r.size?' · '+(r.size<1024*1024?(r.size/1024).toFixed(1)+' KB':(r.size/1024/1024).toFixed(1)+' MB'):''}${r.accepted===false?' · 待核实':''}${dateLabel(r)?' · 更新于 '+esc(dateLabel(r)):''}</p>${r.uploaded?`<p class="muted">教师：${esc(r.teacher||'未注明')} · 学期：${esc(r.semester||'未注明')}</p>`:''}${r.description&&r.uploaded?`<p class="resource-description">${esc(r.description)}</p>`:''}<div class="resource-bottom"><button class="text-button" data-preview="${index}">预览</button><a class="text-button" href="${esc(window.CoursePreview.fileUrl(r.url))}" download target="_blank" rel="noopener noreferrer">下载文件</a>${(r.variants||[]).map((v,j)=>`<a class="text-button" href="${esc(v.url)}" data-preview="${index}" data-variant="${j}">${esc(v.format)} 预览</a>`).join('')}${r.editable?`<button class="text-button" data-edit-resource="${r.id}">修改资料</button>`:''}<button class="text-button" data-feedback-resource="${index}">反馈问题</button></div></div></article>`;
  }
  function detail(c){
    if(currentCourse?.id!==c.id){contentQuery='';contentCategory='';contentTeacher='';contentSemester='';}
    currentCourse=c;
    main.innerHTML=`<div class="container"><div class="breadcrumbs"><a href="#/">全部课程</a><span>/</span><span>${esc(c.name)}</span></div><section class="detail-hero"><div class="section-title"><div><h1>${esc(c.name)}</h1><p>${esc(c.college&&c.college!=='学院未注明'?c.college:'同学新增课程')}${c.sourceType==='community'?' · 同学新增':''}</p></div>${saveButton(c)}</div><p class="detail-description">${esc(c.description)}</p><div class="detail-actions"><button class="button primary" data-write>写经验</button><button class="button secondary" data-share>上传资料</button>${c.editable?`<button class="text-button" data-edit-course>修改课程</button>`:''}</div></section><div class="detail-tools"><div class="tabbar" role="tablist" aria-label="课程内容">${[['resources','资料 '+c.resources.length],['experiences','经验与考核 '+c.experiences.length]].map(([id,label])=>`<button id="tab-${id}" data-tab="${id}" role="tab" aria-selected="${activeTab===id}" aria-controls="detail-content" tabindex="${activeTab===id?0:-1}" class="${activeTab===id?'active':''}">${label}</button>`).join('')}</div>${syncBar()}</div><section id="detail-content" role="tabpanel" aria-labelledby="tab-${activeTab}"></section></div>`;
    const feedback=document.createElement('button');feedback.className='text-button';feedback.textContent='课程信息有误';feedback.dataset.feedbackCourse='';document.querySelector('.detail-actions').append(feedback);
    document.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>setTab(b.dataset.tab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const id=e.key==='Home'?'resources':e.key==='End'?'experiences':b.dataset.tab==='resources'?'experiences':'resources';setTab(id);document.querySelector('#tab-'+id).focus();};});
    renderTab(c);
  }
  function setTab(id){if(activeTab!==id){contentQuery='';contentCategory='';contentTeacher='';contentSemester='';}activeTab=id;document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===id;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});document.querySelector('#detail-content')?.setAttribute('aria-labelledby','tab-'+id);if(currentCourse)renderTab(currentCourse);}
  function renderTab(c){
    const target=document.querySelector('#detail-content');
    const rows=activeTab==='resources'?c.resources:c.experiences;
    if(contentTeacher&&!rows.some(r=>(r.teacher||'未注明')===contentTeacher))contentTeacher='';if(contentSemester&&!rows.some(r=>(r.semester||'未注明')===contentSemester))contentSemester='';
    const options=(field,current)=>'<option value="">全部'+(field==='teacher'?'教师':'学期')+'</option>'+[...new Set(rows.map(r=>r[field]||'未注明'))].sort().map(v=>`<option ${v===current?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');
    target.innerHTML=`<p class="section-note">${activeTab==='resources'?'按用途查找资料，原仓库资料保留来源链接。':'经验仅代表对应教师与学期的个人经历，请以当学期要求为准。'}</p><div class="content-filters"><label class="content-search">搜索内容<input type="search" aria-label="搜索当前课程内容" value="${esc(contentQuery)}" placeholder="输入资料名或经验关键词"></label>${activeTab==='resources'?`<label>资料类型<select id="content-category"><option value="">全部类型</option>${['学习笔记','实验参考','复习资料','其他'].map(v=>`<option ${v===contentCategory?'selected':''}>${v}</option>`).join('')}</select></label>`:''}<label>教师<select id="content-teacher">${options('teacher',contentTeacher)}</select></label><label>学期<select id="content-semester">${options('semester',contentSemester)}</select></label><button class="text-button" id="clear-content-filters">清除筛选</button></div><div id="filtered-items" aria-live="polite"></div>`;
    target.querySelector('[type=search]').oninput=e=>{contentQuery=e.target.value;renderItems(c);};
    target.querySelector('#content-category')?.addEventListener('change',e=>{contentCategory=e.target.value;renderItems(c);});
    target.querySelector('#content-teacher').onchange=e=>{contentTeacher=e.target.value;renderItems(c);};target.querySelector('#content-semester').onchange=e=>{contentSemester=e.target.value;renderItems(c);};
    target.querySelector('#clear-content-filters').onclick=()=>{contentQuery='';contentCategory='';contentTeacher='';contentSemester='';renderTab(c);};renderItems(c);
  }
  function renderItems(c){const resources=activeTab==='resources',needle=contentQuery.trim().toLowerCase();const rows=(resources?c.resources:c.experiences).filter(r=>(!resources||!contentCategory||resourceCategory(r)===contentCategory)&&(!contentTeacher||(r.teacher||'未注明')===contentTeacher)&&(!contentSemester||(r.semester||'未注明')===contentSemester)&&(!needle||[r.title,r.description,r.body,r.teacher,r.semester].join(' ').toLowerCase().includes(needle))).slice().sort((a,b)=>dateLabel(b).localeCompare(dateLabel(a)));document.querySelector('#filtered-items').innerHTML=`<p class="result-count">${rows.length} ${resources?'份资料':'条经验'}</p>`+(rows.length?rows.map(r=>resources?resourceCard(r,c.resources.indexOf(r)):experienceCard(r,c)).join(''):'<div class="empty"><h2>暂无匹配内容</h2><p>可以清除筛选，或在上方补充资料与经验。</p></div>');}
  function route(){
    const raw=location.hash.slice(1)||'/',[path,params='']=raw.split('?');
    const id=path.startsWith('/course/')?path.slice(8):null;
    const canonicalId=window.COURSE_ALIASES?.[id]||id;
    const c=id?courses.find(c=>c.id===canonicalId):null;
    if(c&&c.id!==id)history.replaceState(null,'','#/course/'+c.id+(params?'?'+params:''));
    document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(path==='/mine'?'mine':path==='/bookmarks'?'bookmarks':'home')));
    if(path==='/mine'){currentCourse=null;window.CommunityUI.render();}
    else if(c){const tab=new URLSearchParams(params).get('tab');activeTab=['resources','experiences'].includes(tab)?tab:c.experiences.length?'experiences':'resources';detail(c);}
    else if(id){currentCourse=null;main.innerHTML=`<div class="container"><div class="empty"><h1>${loaded?'暂时未能读取这门课':'正在加载课程…'}</h1><p>${loaded?'请重新连接获取最新课程，或返回列表搜索课程名。':'正在读取同学添加的课程，请稍候。'}</p>${syncBar()}<a class="button secondary" href="#/">返回课程列表</a></div></div>`;}
    else home(path==='/bookmarks');
    document.title=(c?c.name:path==='/mine'?'我的投稿':path==='/bookmarks'?'我的收藏':'课程资料与修课经验')+' · 课间';updateCount();window.scrollTo(0,0);
  }
  function rebuild(data){
    contributions={courses:Array.isArray(data.courses)?data.courses:[],records:Array.isArray(data.records)?data.records:[],resources:Array.isArray(data.resources)?data.resources.map(r=>({...r,url:r.downloadPath?service.fileUrl(r.downloadPath)+'?v='+r.version:r.url})):[],courseOverrides:data.courseOverrides||[],baseEditable:!!data.baseEditable,admin:!!data.admin,reports:data.reports||[]};
    const next=JSON.stringify(contributions),changed=next!==signature,firstMerge=signature==='';signature=next;
    const base=baseCourses.map(c=>({...c,...contributions.courseOverrides.find(o=>o.id===c.id),resources:c.resources,experiences:c.experiences,editable:!!data.baseEditable}));
    courses=[...base,...contributions.courses].map(c=>({...c,resources:[...(c.resources||[]),...contributions.resources.filter(r=>r.courseId===c.id)],experiences:[...(c.experiences||[]),...contributions.records.filter(r=>r.courseId===c.id)]}));window.COURSES=courses;
    if(changed){if(location.hash==='#/mine')window.CommunityUI.render();else if(currentCourse){const c=courses.find(c=>c.id===currentCourse.id);if(c){if(firstMerge&&!location.hash.includes('?tab=')&&c.experiences.length)activeTab='experiences';detail(c);}else route();}else if(document.querySelector('#course-results'))renderResults(location.hash==='#/bookmarks');else if(location.hash.startsWith('#/course/'))route();}
    updateCount();updateSync();updateCourseOptions();
  }
  async function refreshCommunity({automatic=false}={}){
    if(busy)return false;if(automatic&&Date.now()-lastCheck<15000)return false;
    clearTimeout(retryTimer);
    busy=true;lastCheck=Date.now();syncStatus='正在同步…';updateSync();
    try{const data=await service.get();busy=false;loaded=true;retryCount=0;syncStatus='已同步';rebuild(data);if(!currentCourse&&!document.querySelector('#course-results'))route();return true;}
    catch{busy=false;loaded=true;syncStatus='未连接到最新内容，当前显示备份';updateSync();if(!currentCourse&&!document.querySelector('#course-results'))route();if(retryCount<3){retryTimer=setTimeout(()=>refreshCommunity(),[3000,10000,30000][retryCount++]);}return false;}
  }
  async function loadCommunity(){
    try{const response=await fetch('data/community.json',{cache:'no-store'});if(response.ok){const data=await response.json();rebuild(data);}}catch{}
    await refreshCommunity();
  }

  function updateCourseOptions(){const selected=form.elements.course.value;form.elements.course.innerHTML='<option value="">选择课程</option>'+courses.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');if(courses.some(c=>c.id===selected))form.elements.course.value=selected;}
  function openForm(kind,record=null){
    if(saving){toast('正在保存，请稍候');return;}
    mode=kind;editing=record;form.reset();document.querySelector('#submission-result').hidden=true;
    document.querySelector('#dialog-title').textContent=(record?'修改':'')+(kind==='course'?'课程':kind==='resource'?'资料':'经验');
    document.querySelector('#course-select-field').hidden=kind==='course';form.elements.course.required=kind!=='course';
    document.querySelector('#course-name-field').hidden=kind!=='course';form.elements.name.required=kind==='course';
    document.querySelector('#file-field').hidden=kind!=='resource';form.elements.file.required=kind==='resource'&&!record;
    document.querySelector('#file-hint').textContent=record&&kind==='resource'?'当前文件：'+record.title+'。不选择新文件将保留原文件。':'支持文档、表格、代码或 ZIP 文件。';
    document.querySelector('#context-fields').hidden=kind==='course';document.querySelector('#context-fields').open=false;
    document.querySelector('#category-field').hidden=kind!=='resource';form.elements.category.value=record?.category||'其他';
    form.elements.content.required=kind==='experience';form.elements.content.minLength=kind==='experience'?2:0;
    document.querySelector('#content-label').textContent=kind==='experience'?'你的经验':kind==='course'?'课程简介（可选）':'资料说明（可选）';
    form.elements.content.placeholder=kind==='experience'?'学习建议、授课方式、考核要求，都可以写在这里。':kind==='course'?'这门课学什么？也可以先留空。':'可以补充资料来源和适用范围。';
    updateCourseOptions();form.elements.course.value=record?.courseId||currentCourse?.id||'';
    if(record){form.elements.name.value=record.name||'';form.elements.content.value=kind==='experience'?record.body||'':record.description||'';form.elements.teacher.value=record.teacher==='未注明'?'':record.teacher||'';form.elements.semester.value=record.semester==='未注明'?'':record.semester||'';}
    form.querySelector('[type=submit]').textContent=record?'保存修改':kind==='resource'?'上传文件':kind==='course'?'保存课程':'发布经验';dialog.showModal();
  }
  form.onsubmit=async e=>{
    e.preventDefault();if(saving||!form.reportValidity())return;
    const file=form.elements.file.files[0];
    const course=courses.find(c=>c.id===form.elements.course.value),name=form.elements.name.value.trim();
    if(mode==='course'&&!editing){const existing=courses.find(c=>community.nameKey(c.name)===community.nameKey(name));if(existing){dialog.close();location.hash='/course/'+existing.id;toast('这门课已经存在，可以直接补充内容。');return;}}
    const data={kind:mode,id:editing?.id,version:editing?.version||0,courseId:course?.id,name,content:form.elements.content.value.trim(),teacher:form.elements.teacher.value.trim(),semester:form.elements.semester.value.trim(),category:form.elements.category.value};
    const button=form.querySelector('[type=submit]'),oldLabel=button.textContent;button.disabled=true;button.textContent=mode==='resource'?'正在上传…':'正在保存…';saving=true;
    const result=document.querySelector('#submission-result');result.hidden=true;
    try{
      const saved=await service.save(data,file);const next={...contributions};
      const collection=mode==='course'?(baseCourses.some(c=>c.id===saved.id)?'courseOverrides':'courses'):mode==='experience'?'records':'resources';
      next[collection]=[...(next[collection]||[]).filter(r=>r.id!==saved.id),saved.record];rebuild(next);
      dialog.close();const tab=mode==='resource'?'resources':'experiences';const destination='#/course/'+saved.courseId+'?tab='+tab;
      if(location.hash===destination){activeTab=tab;detail(courses.find(c=>c.id===saved.courseId));}else location.hash=destination;
      toast(editing?'修改已保存':mode==='resource'?'文件已上传，可以直接下载':'已保存，其他同学也能看到');await refreshCommunity();
    }catch(error){result.hidden=false;result.textContent=error.message||'保存失败，请稍后重试';}
    finally{saving=false;button.disabled=false;button.textContent=oldLabel;}
  };

  document.querySelector('#close-dialog').onclick=()=>dialog.close();
  dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}};
  document.addEventListener('click',e=>{
    const feedback=e.target.closest('[data-feedback-resource],[data-feedback-record],[data-feedback-course]');if(feedback&&currentCourse){const resource=feedback.hasAttribute('data-feedback-resource')?currentCourse.resources[Number(feedback.dataset.feedbackResource)]:null,record=feedback.hasAttribute('data-feedback-record')?currentCourse.experiences.find(r=>r.id===feedback.dataset.feedbackRecord):null;window.CommunityUI.feedback({courseId:currentCourse.id,targetId:resource?.id||record?.id||(feedback.hasAttribute('data-feedback-course')?currentCourse.id:''),targetTitle:resource?.title||record?.title||currentCourse.name,sourceUrl:resource?.url||''});return;}
    const preview=e.target.closest('[data-preview]');if(preview&&currentCourse){e.preventDefault();const resource=currentCourse.resources[Number(preview.dataset.preview)];if(resource){const variant=preview.hasAttribute('data-variant')?resource.variants?.[Number(preview.dataset.variant)]:null;window.CoursePreview.open({...resource,...variant});}return;}
    const b=e.target.closest('[data-add-course],[data-write],[data-share],[data-refresh],[data-save],[data-edit-record],[data-edit-resource],[data-edit-course]');if(!b)return;
    if(b.hasAttribute('data-add-course'))openForm('course');
    if(b.hasAttribute('data-write'))openForm('experience');
    if(b.hasAttribute('data-share'))openForm('resource');
    if(b.hasAttribute('data-refresh'))refreshCommunity();
    if(b.hasAttribute('data-edit-record'))openForm('experience',contributions.records.find(r=>r.id===b.dataset.editRecord));
    if(b.hasAttribute('data-edit-resource'))openForm('resource',contributions.resources.find(r=>r.id===b.dataset.editResource));
    if(b.hasAttribute('data-edit-course'))openForm('course',currentCourse);
    if(b.hasAttribute('data-save')){
      const id=b.dataset.save;bookmarks.has(id)?bookmarks.delete(id):bookmarks.add(id);
      try{localStorage.setItem('kejian-bookmarks',JSON.stringify([...bookmarks]));}catch{}
      updateCount();if(currentCourse)detail(currentCourse);else renderResults(location.hash==='#/bookmarks');
    }
  });
  function checkOnReturn(){if(document.visibilityState==='visible')refreshCommunity({automatic:true});}
  window.addEventListener('focus',checkOnReturn);document.addEventListener('visibilitychange',checkOnReturn);window.addEventListener('online',checkOnReturn);setInterval(checkOnReturn,120000);
  const adminDialog=document.querySelector('#admin-dialog'),adminForm=document.querySelector('#admin-form');
  document.querySelector('#manage-access').onclick=()=>{document.querySelector('#admin-error').textContent='';adminDialog.showModal();};
  document.querySelector('#close-admin').onclick=()=>adminDialog.close();
  adminForm.onsubmit=async e=>{e.preventDefault();service.setAdminKey(adminForm.elements.key.value.trim());try{const data=await service.get();if(!data.admin)throw new Error('管理密钥不正确');rebuild(data);adminDialog.close();toast('已启用维护者权限');}catch(error){service.setAdminKey('');document.querySelector('#admin-error').textContent=error.message;}};
  if(location.hash.startsWith('#manage=')){service.setAdminKey(decodeURIComponent(location.hash.slice(8)));history.replaceState(null,'',location.pathname+'#/');}
  window.CommunityUI.configure({data:()=>({courses,contributions}),refresh:refreshCommunity,rebuild,edit:openForm,toast,syncBar,removed:id=>{const next={...contributions};for(const key of ['courses','records','resources','reports'])next[key]=(next[key]||[]).filter(r=>r.id!==id);rebuild(next);}});
  window.addEventListener('hashchange',route);route();loadCommunity();
})();
