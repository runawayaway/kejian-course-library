(() => {
  const service=window.CourseService;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let context,feedbackDialog,recoveryDialog,feedbackTarget;
  function modal(id,heading,content){const d=document.createElement('dialog');d.id=id;d.setAttribute('aria-labelledby',id+'-title');d.innerHTML=`<div class="dialog-head"><h2 id="${id}-title">${heading}</h2><button class="icon-button" type="button" aria-label="关闭${heading}">×</button></div>${content}`;document.body.append(d);d.querySelector('.icon-button').onclick=()=>d.close();return d;}
  function render(){
    const {courses,contributions:d}=context.data(),admin=d.admin;
    const groups=[['course','课程',d.courses],['experience','修课经验',d.records],['resource','资料',d.resources]];
    const name=id=>courses.find(c=>c.id===id)?.name||'原课程已删除';
    document.querySelector('main').innerHTML=`<div class="container"><section class="library-heading"><h1>${admin?'内容管理':'我的投稿'}</h1><p>${admin?'维护公开内容，处理同学反馈。':'这里显示当前投稿身份可修改的内容。备份恢复码后，可在其他设备继续修改。'}</p><div class="management-actions"><button class="button secondary" data-recovery>备份 / 恢复投稿</button>${admin?'<button class="text-button" data-logout>退出维护者权限</button>':''}${context.syncBar()}</div></section>${groups.map(([kind,label,rows])=>{const owned=rows.filter(r=>r.editable);return `<section class="submission-group"><h2>${label} <span class="muted">${owned.length}</span></h2>${owned.length?owned.map(r=>`<article class="reading-panel submission-row"><div><h3>${esc(r.name||r.title||'修课经验')}</h3><p class="muted">${esc(name(r.courseId||r.id))} · ${esc((r.updatedAt||r.createdAt||'').slice(0,10))}${r.accepted?' · 已核实':''}</p>${kind==='experience'?`<p class="submission-excerpt">${esc(r.body)}</p>`:''}</div><div class="submission-actions"><a class="text-button" href="#/course/${esc(r.courseId||r.id)}?tab=${kind==='resource'?'resources':'experiences'}">查看课程</a><button class="text-button" data-owned-edit="${esc(r.id)}" data-kind="${kind}">修改</button>${admin?`<button class="text-button" data-review="${esc(r.id)}" data-version="${r.version||0}" data-accepted="${!!r.accepted}">${r.accepted?'取消核实':'标为已核实'}</button>`:''}<button class="text-button danger" data-delete="${esc(r.id)}">删除</button></div></article>`).join(''):`<p class="section-note">${admin?'暂无内容。':'还没有可管理的'+label+'。如曾在其他设备投稿，请使用恢复码。'}</p>`}</section>`;}).join('')}${admin?`<section class="submission-group"><h2>问题反馈 <span class="muted">${(d.reports||[]).filter(r=>r.status==='open').length} 条待处理</span></h2>${(d.reports||[]).length?d.reports.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r=>`<article class="reading-panel"><div class="record-heading"><h3>${esc(r.targetTitle)}</h3><span class="tag">${r.status==='resolved'?'已处理':'待处理'}</span></div><p class="muted">${esc(name(r.courseId))} · ${esc(r.createdAt.slice(0,10))}</p><p class="preserve-lines">${esc(r.reason)}</p><div class="submission-actions"><a class="text-button" href="#/course/${esc(r.courseId)}">查看课程</a><button class="text-button" data-resolve="${r.id}" data-version="${r.version}" data-status="${r.status==='resolved'?'open':'resolved'}">${r.status==='resolved'?'重新打开':'标记已处理'}</button></div></article>`).join(''):'<p class="section-note">暂无问题反馈。</p>'}</section>`:''}</div>`;
  }
  function feedback(target){
    if(!feedbackDialog){feedbackDialog=modal('feedback-dialog','反馈问题','<p class="form-note" id="feedback-target"></p><form><label>问题说明<textarea name="reason" required maxlength="2000" rows="5" placeholder="例如：文件无法打开、课程归类不正确，或考核信息已过时。"></textarea></label><p class="form-note">说明仅供维护者处理，不会公开显示。提交后可关闭窗口。</p><div class="form-actions"><button class="button primary" type="submit">提交反馈</button></div><p role="status"></p></form>');
      feedbackDialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('[type=submit]'),status=e.target.querySelector('[role=status]');b.disabled=true;status.textContent='正在提交…';try{await service.save({kind:'report',...feedbackTarget,content:e.target.elements.reason.value.trim()});status.textContent='已提交，维护者会在管理页面处理。';}catch(error){status.textContent=error.message;b.disabled=false;}};
    }
    feedbackTarget=target;feedbackDialog.querySelector('form').reset();feedbackDialog.querySelector('[role=status]').textContent='';feedbackDialog.querySelector('[type=submit]').disabled=false;feedbackDialog.querySelector('#feedback-target').textContent='反馈对象：'+target.targetTitle;feedbackDialog.showModal();
  }
  function recovery(){
    if(!recoveryDialog){recoveryDialog=modal('recovery-dialog','备份与恢复投稿','<p class="form-note">恢复码用于在其他设备修改你的投稿，请妥善保存，不要分享。清除浏览器数据前请先备份。它不会包含维护者密钥。</p><button class="button secondary" type="button" data-export-key>查看并备份恢复码</button><div id="recovery-export" hidden><label>当前恢复码<textarea readonly rows="3" spellcheck="false"></textarea></label><button class="text-button" type="button" data-download-key>保存恢复码文件</button></div><form><label>使用已有恢复码<textarea name="key" required rows="3" spellcheck="false" autocomplete="off" placeholder="粘贴此前保存的 64 位恢复码"></textarea></label><p class="form-note">恢复会切换当前投稿身份。请先备份本设备已有的恢复码。</p><div class="form-actions"><button class="button primary" type="submit">切换并恢复</button></div><p role="status"></p></form>');
      recoveryDialog.querySelector('[data-export-key]').onclick=()=>{recoveryDialog.querySelector('#recovery-export').hidden=false;recoveryDialog.querySelector('#recovery-export textarea').value=service.recoveryCode();};
      recoveryDialog.querySelector('[data-download-key]').onclick=()=>{const url=URL.createObjectURL(new Blob([service.recoveryCode()],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='课间-投稿恢复码.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
      recoveryDialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button'),s=e.target.querySelector('[role=status]');b.disabled=true;try{const data=await service.restore(e.target.elements.key.value.trim());context.rebuild(data);recoveryDialog.close();location.hash='/mine';render();context.toast('投稿已恢复，现在可以继续修改');}catch(error){s.textContent=error.message;}finally{b.disabled=false;}};
      recoveryDialog.addEventListener('close',()=>{recoveryDialog.querySelector('#recovery-export textarea').value='';recoveryDialog.querySelector('form').reset();});
    }
    recoveryDialog.querySelector('#recovery-export').hidden=true;recoveryDialog.querySelector('[role=status]').textContent='';recoveryDialog.showModal();
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-recovery],[data-owned-edit],[data-delete],[data-resolve],[data-review],[data-logout]');if(!b||!context)return;
    if(b.hasAttribute('data-recovery'))return recovery();
    const d=context.data().contributions,rows=[...d.courses,...d.records,...d.resources];
    if(b.hasAttribute('data-owned-edit'))return context.edit(b.dataset.kind,rows.find(r=>r.id===b.dataset.ownedEdit));
    if(b.hasAttribute('data-delete')&&!confirm('确定删除这条内容吗？上传文件也会删除。课程中还有资料或经验时无法删除课程。'))return;
    b.disabled=true;try{
      if(b.hasAttribute('data-delete')){await service.remove(b.dataset.delete);context.removed(b.dataset.delete);}
      if(b.hasAttribute('data-review'))await service.moderate(b.dataset.review,{version:Number(b.dataset.version),accepted:b.dataset.accepted!=='true'});
      if(b.hasAttribute('data-resolve'))await service.moderate(b.dataset.resolve,{version:Number(b.dataset.version),status:b.dataset.status});
      if(b.hasAttribute('data-logout'))service.setAdminKey('');
      await context.refresh();if(location.hash==='#/mine')render();context.toast('已完成');
    }catch(error){context.toast(error.message);}finally{b.disabled=false;}
  });
  window.CommunityUI={configure:value=>context=value,render,feedback};
})();
