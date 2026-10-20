(() => {
  'use strict';
  const courses = window.COURSES;
  const config = window.SITE_CONFIG;
  const main = document.querySelector('main');
  const dialog = document.querySelector('dialog');
  const form = document.querySelector('#contribution-form');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function readSet(key) { try { const v = JSON.parse(localStorage.getItem(key)); return new Set(Array.isArray(v) ? v.filter(x => typeof x === 'string') : []); } catch { return new Set(); } }
  const bookmarks = readSet('kejian-bookmarks');
  const helpful = readSet('kejian-helpful');
  let filter = '全部课程', query = '', college = '', currentCourse, activeTab = 'overview', toastTimer;
  const repository = /^[\w.-]+\/[\w.-]+$/.test(config.repository) ? config.repository : '';
  let communityStatus = '正在读取投稿…', communityBusy = false;
  const baseExperiences = new Map(courses.map(c=>[c.id,[...c.experiences]]));
  function communityToolbar() { return `<div class="community-toolbar"><p role="status">${esc(communityStatus)}</p><button class="button secondary compact" data-refresh-community ${communityBusy?'disabled':''}>${communityBusy?'正在刷新…':'刷新课程投稿'}</button></div>`; }
  function experienceCard(e, c) {
    return `<article class="reading-panel community-record"><div class="record-heading"><h2>${esc(e.title)}</h2><span class="tag">${esc(e.status||'已收录')}</span></div><div class="experience-meta">${esc(e.author)} · 教师：${esc(e.teacher||c.teacher)} · 学期：${esc(e.semester||c.semester)}</div><p class="preserve-lines">${esc(e.body)}</p>${e.advice?`<h3>学习建议</h3><div class="advice">${esc(e.advice)}</div>`:''}${e.assessment?`<h3>考核准备</h3><p>${esc(e.assessment)}</p>`:''}<p class="muted">个人经历仅适用于记录的教师与学期，请核对当学期要求。${e.accepted===false?'此投稿待核实，未纳入授课与考核参考。':''}</p>${e.url?`<a class="text-button" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">查看原始投稿 #${e.number} ↗</a>`:''}</article>`;
  }
  function teachingReferences(c) {
    const records=c.experiences.filter(e=>e.accepted!==false&&e.teaching);
    return `<section class="teaching-references"><h3>授课与考核参考</h3><p class="muted">来自同学修课记录；不同教师、学期分别展示，不能当作全校统一要求。</p>${records.length?records.map(e=>experienceCard(e,c)).join(''):`<p>${esc(c.style)}</p><div class="advice">${esc(c.assessment)}</div>`}<button class="text-button" data-contribute="experience">补充授课与考核经历</button></section>`;
  }
  function installCommunity(records) {
    for(const c of courses)c.experiences=[...baseExperiences.get(c.id),...records.filter(e=>e.courseId===c.id)];
    const focused=document.activeElement?.id;
    if(currentCourse)detail(currentCourse);
    else if(document.querySelector('#course-results'))renderResults(location.hash==='#/bookmarks');
    if(focused?.startsWith('tab-'))document.getElementById(focused)?.focus();
  }
  async function refreshCommunity() {
    if(communityBusy||!repository)return;
    communityBusy=true;communityStatus='正在读取 GitHub 投稿…';if(currentCourse)renderTab(currentCourse);
    try {
      const issues=[];
      for(let page=1;page<=10;page++){
        const response=await fetch(`https://api.github.com/repos/${repository}/issues?state=all&per_page=100&page=${page}`,{headers:{Accept:'application/vnd.github+json'},cache:'no-store',signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error(String(response.status));
        const batch=await response.json();if(!Array.isArray(batch))throw new Error('Invalid response');issues.push(...batch);
        if(batch.length<100)break;if(page===10)throw new Error('Too many pages');
      }
      const records=issues.map(i=>window.CourseCommunity.parseIssue(i,courses,repository)).filter(Boolean);
      communityStatus='已读取最新 GitHub 投稿；待核实内容单独标注。';communityBusy=false;installCommunity(records);
    } catch {
      communityStatus='暂时无法读取最新投稿（网络或 GitHub 访问额度限制）。保留已加载记录，请稍后重试。';communityBusy=false;if(currentCourse)renderTab(currentCourse);
    }
  }
  async function loadCommunity() {
    try {
      const response=await fetch('data/community.json',{cache:'no-store'});if(!response.ok)throw new Error('No snapshot');
      const snapshot=await response.json();if(snapshot.repository!==repository||!Array.isArray(snapshot.records))throw new Error('Invalid snapshot');
      communityStatus='已加载随网站发布的投稿，正在检查最新内容…';installCommunity(snapshot.records);
    } catch { communityStatus='未加载到投稿快照，正在尝试 GitHub…'; }
    await refreshCommunity();
  }
  function persist(key, set) { try { localStorage.setItem(key, JSON.stringify([...set])); } catch { toast('浏览器无法保存，当前选择仅在本次访问中保留'); } }
  function toast(message) { const box = document.querySelector('#toast'); box.textContent = message; box.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('visible'), 3200); }
  function updateCount() { document.querySelector('#bookmark-count').textContent = courses.filter(c => bookmarks.has(c.id)).length; }
  function saveButton(c) { return `<button class="save ${bookmarks.has(c.id)?'saved':''}" data-save="${c.id}" aria-pressed="${bookmarks.has(c.id)}" aria-label="${bookmarks.has(c.id)?'取消收藏':'收藏'}${esc(c.name)}" title="${bookmarks.has(c.id)?'取消收藏':'收藏课程'}">${bookmarks.has(c.id)?'★':'☆'}</button>`; }
  function card(c) { return `<article class="course-card"><div class="card-top"><span class="course-icon ${c.color}" aria-hidden="true">${c.icon}</span>${saveButton(c)}</div><h3><a href="#/course/${c.id}">${esc(c.name)}</a></h3><div class="course-meta">${esc(c.college)} · ${esc(c.category)} · ${c.credits == null ? '学分未提供' : c.credits + ' 学分'}</div><p>${esc(c.description)}</p><div class="tags">${c.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="card-foot"><span>▤ ${c.resources.length} 个资料入口</span><span>▧ ${c.experiences.length} 篇经验</span><span>♧ ${c.questions.length} 个问答</span><a href="#/course/${c.id}" aria-label="查看${esc(c.name)}">↗</a></div></article>`; }
  function sidebar() { return `<aside class="sidebar"><section class="side-panel green-panel"><span class="small-label">一个人的笔记，一群人的收获</span><h3>你走过的弯路，<br>可以成为别人的路标。</h3><p>一份整理好的笔记，一次真实的修课经历，都是留给下一位同学的礼物。</p><button class="button" data-contribute="experience">＋ 我也来分享</button></section><section class="side-panel"><h3>如何参与共建</h3><div class="step"><span class="step-num">1</span><div><strong>找到你学过的课程</strong><p>浏览课程，看看还有什么可以补充。</p></div></div><div class="step"><span class="step-num">2</span><div><strong>分享资料或修课经验</strong><p>标注教师、学期和资料来源。</p></div></div><div class="step"><span class="step-num">3</span><div><strong>审核后，让更多人看到</strong><p>提交后刷新课程投稿，待核实记录会单独标注。</p></div></div><a class="text-button" href="#/guide">阅读完整共建指南 ↗</a></section><p class="notice">收录西北农林科技大学信息工程学院公开课程资料。来自 runawayaway 与学长们的共同贡献；参考前请核对任课教师要求。</p></aside>`; }
  function home(savedOnly = false) {
    currentCourse = null;
    main.innerHTML = `<div class="container">${savedOnly ? `<div class="detail-hero"><span class="hero-kicker">你的学习资料架</span><h1>我的收藏</h1><p class="detail-description">把关心的课程留在这里，随时回来接着学。收藏保存在当前浏览器。</p></div>` : `<section class="hero"><div><div class="hero-kicker">西北农林科技大学 · 信息工程学院</div><h1>每一门课，<br>都有前人的经验可循。</h1><p>课程资料、修课心得、学习问答，在这里找到彼此。<br>把散落的知识整理起来，把有用的经验传下去。</p><div class="hero-bottom"><a href="#course-library" class="button primary">寻找我的课程 <span aria-hidden="true">↓</span></a><span>不必从零开始，也欢迎留下你的那一份。</span></div></div><div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><span class="art-star">✳</span><div class="paper back"><div class="paper-heading"></div><div class="paper-line"></div><div class="paper-line"></div></div><div class="paper front"><div class="paper-heading"></div><div class="paper-line"></div><div class="paper-line short"></div><span class="paper-mark">✧</span><div class="paper-line short"></div></div><span class="art-chip one">▤ 笔记，不只属于一个人</span><span class="art-chip two">✓ 让经验有迹可循</span></div></section><section class="intro-strip" aria-label="资料库概览"><div class="intro-stat"><strong>${courses.length}</strong> 门课程</div><div class="intro-stat"><strong>${config.documentCount}</strong> 组文档资料</div><div class="intro-stat"><strong>${courses.reduce((n,c)=>n+(c.fileCount||0),0)}</strong> 个源文件</div><span class="strip-note">每一次分享，都让这座资料库更完整。</span></section>`}
    <div class="content-layout"><section id="course-library"><div class="section-title"><div><h2>${savedOnly?'已收藏的课程':'发现你的下一门课'}</h2><p>按课程找到资料，带着经验开始学习。</p></div><button class="text-button" id="clear-filters">重置筛选</button></div><div class="searchbox"><span aria-hidden="true">⌕</span><input id="course-search" type="search" aria-label="搜索课程" placeholder="搜索课程名称、学院、课程代码或关键词…" value="${esc(query)}"></div><div class="filters" aria-label="课程筛选">${['全部课程',...new Set(courses.map(c=>c.category))].map(t=>`<button class="filter ${filter===t?'selected':''}" data-filter="${t}" aria-pressed="${filter===t}">${t}</button>`).join('')}<select class="college-select" id="college-filter" aria-label="按学院筛选"><option value="">所有学院</option>${[...new Set(courses.map(c=>c.college))].map(t=>`<option ${college===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div><div id="course-results" aria-live="polite"></div></section>${sidebar()}</div><section class="bottom-banner"><div><h3>没有找到你的课程？一起把它加进来。</h3><p>这份资料库属于每一个愿意分享的同学。</p></div><button class="button secondary" data-contribute="feedback">建议新增课程 ↗</button></section></div>`;
    document.querySelector('.notice').insertAdjacentHTML('beforeend', `<br><a class="text-button" href="https://github.com/${esc(config.sourceRepository)}" target="_blank" rel="noopener noreferrer">查看资料来源仓库 ↗</a>`);
    document.querySelector('#course-search').addEventListener('input', e => { query = e.target.value; renderResults(savedOnly); });
    document.querySelector('#college-filter').addEventListener('change', e => { college = e.target.value; renderResults(savedOnly); });
    document.querySelector('#clear-filters').onclick = () => { query='';filter='全部课程';college='';home(savedOnly); };
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{ filter=b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});renderResults(savedOnly); });
    renderResults(savedOnly);
  }
  function renderResults(savedOnly) {
    const needle=query.trim().toLocaleLowerCase();
    const found=courses.filter(c=>(!savedOnly||bookmarks.has(c.id))&&(filter==='全部课程'||c.category===filter)&&(!college||c.college===college)&&[c.name,c.code,c.college,c.category,...c.tags,...c.resources.map(r=>r.title)].join(' ').toLocaleLowerCase().includes(needle));
    document.querySelector('#course-results').innerHTML=`<p class="result-count">共找到 ${found.length} 门课程</p>${found.length?`<div class="course-grid">${found.map(card).join('')}</div><div class="library-end">${savedOnly?'收藏伴你慢慢积累':'已经看到全部课程 · 更多内容等你一起补充'}</div>`:`<div class="empty"><h2>${savedOnly&&!bookmarks.size?'还没有收藏课程':'暂时没有匹配的课程'}</h2><p>${savedOnly&&!bookmarks.size?'点击课程卡片上的星标，将它放上你的资料架。':'试试其他关键词，或重置学院与课程类别筛选。'}</p><a class="button secondary" href="#/">浏览全部课程</a></div>`}`;
  }
  function detail(c) {
    currentCourse=c;
    main.innerHTML=`<div class="container"><div class="breadcrumbs"><a href="#/">发现课程</a><span>/</span><span>${esc(c.name)}</span></div><section class="detail-hero"><div class="detail-heading"><span class="course-icon ${c.color}">${c.icon}</span><div><h1>${esc(c.name)}</h1><div class="course-meta">${esc(c.code)} · ${esc(c.college)} · ${esc(c.category)} · ${c.credits == null ? '学分未提供' : c.credits + ' 学分'}</div></div></div><p class="detail-description">${esc(c.description)}</p><div class="detail-actions"><button class="button primary" data-contribute="resource">＋ 分享课程资料</button><button class="button secondary" data-save="${c.id}" aria-pressed="${bookmarks.has(c.id)}">${bookmarks.has(c.id)?'★ 已收藏':'☆ 收藏课程'}</button></div></section><div class="sample-note">资料来自 NWAFU-coursework-experimental-report，原仓库由多位同学共同贡献。原始作业未提供统一授课信息；同学补充的教师、学期和考核经历见下方修课记录。</div><div class="tabbar" role="tablist" aria-label="课程内容">${[['overview','课程介绍'],['resources',`学习资料 ${c.resources.length}`],['experiences',`修课经验 ${c.experiences.length}`],['questions',`课程问答 ${c.questions.length}`]].map(([id,title])=>`<button role="tab" id="tab-${id}" aria-controls="detail-content" aria-selected="${activeTab===id}" tabindex="${activeTab===id?'0':'-1'}" class="${activeTab===id?'active':''}" data-tab="${id}">${title}</button>`).join('')}</div><div class="detail-layout"><section id="detail-content" role="tabpanel" aria-labelledby="tab-${activeTab}"></section><aside><section class="side-panel"><h3>课程信息</h3><dl class="info-list"><dt>课程代码</dt><dd>${esc(c.code)}</dd><dt>先修基础</dt><dd>${esc(c.prerequisites)}</dd><dt>学习投入</dt><dd>${esc(c.workload)}</dd><dt>内容性质</dt><dd>公开仓库课程资料</dd></dl></section><section class="side-panel green-panel"><h3>这门课，你也上过？</h3><p>你的学习方法、踩坑记录和复习建议，都能帮助下一位同学。</p><button class="button" data-contribute="experience">写一篇修课经验</button></section><button class="text-button" data-contribute="feedback">发现内容错误？提交反馈 ↗</button></aside></div></div>`;
    document.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>setTab(b.dataset.tab);b.onkeydown=e=>{const list=[...document.querySelectorAll('[data-tab]')];let idx=list.indexOf(b);if(e.key==='ArrowRight')idx=(idx+1)%list.length;else if(e.key==='ArrowLeft')idx=(idx+list.length-1)%list.length;else if(e.key==='Home')idx=0;else if(e.key==='End')idx=list.length-1;else return;e.preventDefault();list[idx].focus();setTab(list[idx].dataset.tab);};});
    renderTab(c);
  }
  function setTab(id) { activeTab=id;document.querySelectorAll('[data-tab]').forEach(x=>{const on=x.dataset.tab===id;x.classList.toggle('active',on);x.setAttribute('aria-selected',String(on));x.tabIndex=on?0:-1;});document.querySelector('#detail-content').setAttribute('aria-labelledby',`tab-${id}`);renderTab(currentCourse); }
  function renderTab(c) {
    const target=document.querySelector('#detail-content');
    if(activeTab==='overview') target.innerHTML=communityToolbar()+`<article class="reading-panel"><h2>课程资料概览</h2><p>${esc(c.overview)}</p>${c.sourceUrl?`<a class="button secondary compact" href="${esc(c.sourceUrl)}" target="_blank" rel="noopener noreferrer">浏览原仓库课程目录 ↗</a>`:''}<h3>开始之前</h3><p>${esc(c.prerequisites)}</p>${teachingReferences(c)}<h3>建议的学习方式</h3><p>结合课程大纲安排学习，用资料辅助理解，保留自己的实验记录和错题。不同学期要求可能变化，请核对授课信息。</p></article>`;
    if(activeTab==='resources') target.innerHTML=c.resources.map((r,i)=>`<article class="reading-panel"><div class="resource-row"><span class="file-icon">${esc(r.format)}</span><div class="resource-body"><h3>${esc(r.title)}</h3><span class="tag">${esc(r.kind)}</span><p>${esc(r.description)}</p><div class="resource-source">来源：${esc(r.source)}<br>分享权限：${esc(r.permission)}<br>适用：${esc(c.semester)} · ${esc(c.teacher)}</div><div class="resource-bottom"><a class="button secondary compact" href="${esc(r.url)}" ${r.local?'download':'target="_blank" rel="noopener noreferrer"'}>${r.local?'下载笔记 ↓':r.format==='DIR'?'浏览完整目录 ↗':'查看原始文件 ↗'}</a>${(r.variants||[]).map(v=>`<a class="button secondary compact" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.format)} 格式 ↗</a>`).join('')}<button class="text-button" data-feedback="${i}">报告失效 / 纠错</button></div></div></div></article>`).join('');
    if(activeTab==='experiences') target.innerHTML=communityToolbar()+(c.experiences.length?'':`<div class="empty"><h2>修课经验，等你补上</h2><p>仓库提供了作业与报告，尚未收录注明教师、学期的个人修课经验。</p></div>`)+c.experiences.map(e=>experienceCard(e,c)).join('')+`<button class="button secondary" data-contribute="experience">＋ 分享我的修课经验</button>`;
    if(activeTab==='questions') target.innerHTML=(c.questions.length?c.questions.map(q=>{const key=c.id+'/'+q.id;return `<article class="reading-panel"><h2>${esc(q.title)}</h2><div class="experience-meta">${esc(c.semester)} · ${esc(c.teacher)} · 课程问答</div><div class="answer"><span class="small-label">${esc(q.author)}的回答</span><p>${esc(q.answer)}</p></div><div class="answer-actions"><button class="text-button" data-helpful="${key}" aria-pressed="${helpful.has(key)}">${helpful.has(key)?'✓ 已标记有帮助':'♡ 对我有帮助'}</button><button class="text-button" data-answer="${esc(q.title)}">补充回答</button></div></article>`;}).join(''):`<div class="empty"><h2>好问题，是学习的开始</h2><p>这门课还没有收录问答，欢迎提出你的第一个问题。</p></div>`)+`<button class="button primary" data-contribute="question">＋ 提出课程问题</button>`;
  }
  function guide() {currentCourse=null;main.innerHTML=`<div class="guide"><span class="hero-kicker">一份可以接力的校园资料库</span><h1>把你的经验，留给下一位同学。</h1><p class="detail-description">课间以课程为中心，收集可追溯的学习资料与修课经验。任何人都能浏览；贡献内容通过 GitHub 提交，由维护者审核。</p><section class="reading-panel"><h2>怎样贡献内容</h2><ol><li>找到课程，点击「分享课程资料」「写一篇修课经验」或「提出课程问题」。</li><li>填写标题、教师、学期和具体内容。资料请补充来源、原始链接与分享权限。</li><li>生成投稿文稿。配置仓库后，可打开已预填内容的 GitHub Issue，登录 GitHub 后提交。</li><li>提交 Issue 后回到课程点击「刷新课程投稿」。维护者投稿和带「已收录」标签的记录可用于授课参考，其他记录标为待核实。</li></ol><button class="button primary" data-contribute="experience">开始贡献</button></section><section class="reading-panel"><h2>分享什么，会更有帮助？</h2><p>你原创的知识梳理、实验排错记录、公开资料链接，以及注明学期与教师的学习经历。经验可以描述课堂节奏、学习投入、作业形式和复习方法。</p><p>避免以偏概全，不进行教师评分和排名。不上传未经许可的课件、个人信息和未公开试题。链接失效或内容过期，可通过课程页面提交反馈。</p></section><section class="reading-panel"><h2>当前版本的协作方式</h2><p>网站是可部署到 GitHub Pages 的静态资料库。收藏和「有帮助」标记只保存在当前浏览器，不作为全站统计。网页不提供站内注册或在线文件上传。修课投稿从公开 GitHub Issue 读取，未收录的记录单独标注；网络不可用时保留网站发布时的记录。</p><p>${repository?`协作仓库：<a class="text-button" href="https://github.com/${repository}" target="_blank" rel="noopener noreferrer">${esc(repository)} ↗</a>`:'维护者尚未配置 GitHub 仓库。你仍可生成并下载投稿文稿；仓库配置完成后即可在线提交。'}</p><p>维护者在 <code>data/courses.js</code> 设置 <code>SITE_CONFIG.repository</code>，并维护课程数据。新课程建议、问答补充和纠错均通过 Issue 审核处理。</p></section></div>`;}
  function route() {
    const path=location.hash.replace(/^#/, '')||'/';activeTab='overview';
    document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===(path==='/bookmarks'?'bookmarks':path==='/guide'?'guide':'home')));
    if(path==='/'||path==='/bookmarks') home(path==='/bookmarks');
    else if(path==='/guide')guide();
    else if(path.startsWith('/course/')){const c=courses.find(c=>c.id===path.slice(8));if(c)detail(c);else notFound();}
    else if(path==='course-library'){home();requestAnimationFrame(()=>document.querySelector('#course-library').scrollIntoView());return;}
    else notFound();
    document.title=currentCourse?`${currentCourse.name} · 课间`:`${path==='/bookmarks'?'我的收藏':path==='/guide'?'共建指南':'发现课程'} · 课间`;
    window.scrollTo(0,0);updateCount();
  }
  function notFound(){currentCourse=null;main.innerHTML='<div class="guide"><div class="empty"><h1>这门课还没收录</h1><p>链接可能已变更，回到资料库找找看。</p><a href="#/" class="button primary">返回课程资料库</a></div></div>';}
  form.elements.course.innerHTML='<option value="general">其他 / 建议新增课程</option>'+courses.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  function openContribution(type='experience',title='') {
    form.reset();form.elements.type.value=type;form.elements.course.value=currentCourse?.id||'general';form.elements.title.value=title;
    form.elements.url.required=type==='resource';form.elements.source.required=type==='resource';document.querySelector('#experience-topics').hidden=type!=='experience';
    document.querySelector('#resource-fields').hidden=type!=='resource';document.querySelector('#submission-result').hidden=true;
    dialog.showModal();
  }
  function draft() {
    const d=new FormData(form);const c=courses.find(c=>c.id===d.get('course'));const type=form.elements.type.selectedOptions[0].textContent;
    return {title:`[${type}] ${d.get('title')}`,body:`## ${type}\n\n- 课程：${c?c.name:'其他 / 建议新增课程'}\n- 学期：${d.get('semester')}\n- 授课教师：${d.get('teacher')}\n${d.get('type')==='experience'?'- 内容包含：'+(d.getAll('topic').join('、')||'学习方法')+'\n':''}\n## 具体内容\n\n${d.get('content')}\n${d.get('type')==='resource'?`\n## 资料信息\n\n- 链接：${d.get('url')}\n- 来源：${d.get('source')}\n- 分享权限：${d.get('permission')}\n`:''}\n---\n由课间投稿表单生成，待维护者审核。\n`};
  }
  function validate() {const resource=form.elements.type.value==='resource';form.elements.url.required=resource;form.elements.source.required=resource;return form.reportValidity();}
  form.elements.type.onchange=()=>{document.querySelector('#experience-topics').hidden=form.elements.type.value!=='experience';document.querySelector('#resource-fields').hidden=form.elements.type.value!=='resource';form.elements.url.required=form.elements.type.value==='resource';form.elements.source.required=form.elements.type.value==='resource';document.querySelector('#submission-result').hidden=true;};
  form.addEventListener('input',()=>{document.querySelector('#submission-result').hidden=true;});
  form.onsubmit=e=>{e.preventDefault();if(!validate())return;const d=draft();const result=document.querySelector('#submission-result');result.hidden=false;result.innerHTML=`<strong>文稿已生成，还需打开 GitHub 并点击 Create 完成提交。</strong><textarea aria-label="投稿 Markdown 文稿" readonly></textarea><p>提交后回到课程，点击「刷新课程投稿」查看。待核实投稿不会直接作为授课与考核参考。</p><button class="button secondary compact" id="copy-draft" type="button">复制文稿</button> ${repository?`<a id="github-submit" class="button primary compact" target="_blank" rel="noopener noreferrer">打开 GitHub 投稿 ↗</a>`:'<p>维护者尚未配置协作仓库。可复制或下载文稿，交给维护者审核。</p>'}`;result.querySelector('textarea').value=`# ${d.title}\n\n${d.body}`;if(repository)result.querySelector('#github-submit').href=`https://github.com/${repository}/issues/new?title=${encodeURIComponent(d.title)}&body=${encodeURIComponent(d.body)}`;result.querySelector('#copy-draft').onclick=async()=>{try{await navigator.clipboard.writeText(`# ${d.title}\n\n${d.body}`);toast('投稿文稿已复制');}catch{result.querySelector('textarea').select();toast('请按 Ctrl+C 复制已选中的文稿');}};result.scrollIntoView({block:'nearest'});};
  document.querySelector('#download-draft').onclick=()=>{if(!validate())return;const d=draft();const url=URL.createObjectURL(new Blob([`# ${d.title}\n\n${d.body}`],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='kejian-contribution.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('投稿文稿已下载，审核后才会发布');};
  document.querySelector('#header-contribute').onclick=()=>openContribution();document.querySelector('#close-dialog').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-refresh-community],[data-save],[data-contribute],[data-feedback],[data-helpful],[data-answer]');if(!b)return;
    if(b.hasAttribute('data-refresh-community')){refreshCommunity();return;}
    if(b.hasAttribute('data-save')){const id=b.dataset.save;bookmarks.has(id)?bookmarks.delete(id):bookmarks.add(id);persist('kejian-bookmarks',bookmarks);updateCount();if(currentCourse){b.innerHTML=bookmarks.has(id)?'★ 已收藏':'☆ 收藏课程';b.setAttribute('aria-pressed',String(bookmarks.has(id)));}else{const on=bookmarks.has(id);b.classList.toggle('saved',on);b.textContent=on?'★':'☆';b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',`${on?'取消收藏':'收藏'}${courses.find(c=>c.id===id).name}`);if(location.hash==='#/bookmarks')renderResults(true);}toast(bookmarks.has(id)?'已收藏，保存在当前浏览器':'已取消收藏');}
    if(b.hasAttribute('data-contribute'))openContribution(b.dataset.contribute);
    if(b.hasAttribute('data-feedback'))openContribution('feedback',`资料反馈：${currentCourse.resources[Number(b.dataset.feedback)].title}`);
    if(b.hasAttribute('data-answer'))openContribution('answer',`回答：${b.dataset.answer}`);
    if(b.hasAttribute('data-helpful')){const key=b.dataset.helpful;helpful.has(key)?helpful.delete(key):helpful.add(key);persist('kejian-helpful',helpful);b.setAttribute('aria-pressed',String(helpful.has(key)));b.textContent=helpful.has(key)?'✓ 已标记有帮助':'♡ 对我有帮助';toast('标记已更新，仅保存在当前浏览器');}
  });
  window.addEventListener('hashchange',route);route();loadCommunity();
})();
