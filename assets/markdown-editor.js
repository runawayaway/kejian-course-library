/* In-place Markdown editing: shared originals require administrator authorization. */
(() => {
 function attach({resource,source,body,heading,note,render,download}){
  if(resource.uploaded&&!resource.editable)return;
  const button=document.createElement('button');button.type='button';button.className='button secondary';button.id='edit-markdown';button.textContent='编辑原文';
  heading.insertBefore(button,heading.querySelector('.icon-button'));
  button.onclick=()=>{
   button.hidden=true;
   const editor=document.createElement('section');editor.className='markdown-editor';
   editor.innerHTML='<div class="markdown-editor-tools"><button type="button" class="button primary" data-save-markdown>保存修改</button><button type="button" class="button secondary" data-preview-markdown>预览效果</button><button type="button" class="text-button" data-cancel-markdown>取消</button><span role="status" aria-live="polite"></span></div><p class="muted">保存后更新当前课程中的原文，其他人刷新后可见。</p><label class="markdown-admin" hidden>维护者密钥<input type="password" autocomplete="off" placeholder="首次修订共享资料时填写"></label><textarea aria-label="Markdown 原文" spellcheck="false"></textarea><div class="markdown-draft-preview" hidden></div>';
   const area=editor.querySelector('textarea'),status=editor.querySelector('[role=status]'),auth=editor.querySelector('.markdown-admin'),save=editor.querySelector('[data-save-markdown]'),preview=editor.querySelector('[data-preview-markdown]'),draft=editor.querySelector('.markdown-draft-preview');
   area.value=source;auth.hidden=!!resource.uploaded||CourseService.hasAdmin();body.replaceChildren(editor);note.textContent='正在编辑原文，修改尚未保存';area.focus();
   let saving=false;
   const leave=()=>{body.replaceChildren(render(source));button.hidden=false;note.textContent='Markdown 阅读预览';};
   editor.querySelector('[data-cancel-markdown]').onclick=()=>{if(!saving&&(area.value===source||confirm('放弃尚未保存的修改？')))leave();};
   preview.onclick=()=>{const showing=draft.hidden;draft.hidden=!showing;area.hidden=showing;preview.textContent=showing?'继续编辑':'预览效果';if(showing)draft.replaceChildren(render(area.value));};
   save.onclick=async()=>{
    if(saving)return;status.textContent='';if(!area.value.trim()){status.textContent='原文不能为空';return;}
    if(new TextEncoder().encode(area.value).length>100000){status.textContent='在线编辑支持不超过 100 KB 的原文';return;}
    saving=true;save.disabled=true;editor.querySelector('[data-cancel-markdown]').disabled=true;status.textContent='正在保存…';
    try{
     if(!resource.uploaded&&!CourseService.hasAdmin()){
      const key=auth.querySelector('input').value.trim();if(!key)throw new Error('请填写维护者密钥；自己的上传资料无需此密钥');
      CourseService.setAdminKey(key);
      try{const permissions=await CourseService.get();if(!permissions.admin)throw new Error('维护者密钥不正确');}catch(error){CourseService.setAdminKey('');throw error;}
     }
     let saved;
     if(resource.uploaded){
      const filename=resource.filename||resource.title;
      saved=await CourseService.save({kind:'resource',id:resource.id,version:resource.version,courseId:resource.courseId,content:resource.description||'',category:resource.category||'学习笔记',teacher:resource.teacher||'',semester:resource.semester||''},new File([area.value],filename,{type:'text/markdown'}));
      Object.assign(resource,saved.record,{url:CourseService.fileUrl(saved.record.downloadPath)+'?v='+saved.version});
     }else{
      saved=await CourseService.saveDocument({courseId:resource.courseId,sourceUrl:resource.originalUrl||resource.url,title:resource.title,content:area.value,version:resource.documentVersion||0});
      resource.originalUrl=resource.originalUrl||resource.url;resource.documentVersion=saved.version;resource.documentId=saved.id;resource.url=CourseService.fileUrl(saved.record.downloadPath)+'?v='+saved.version;
     }
     source=area.value;download.href=resource.url;auth.querySelector('input').value='';leave();note.textContent='原文修改已保存，其他人刷新后可见';
     window.dispatchEvent(new CustomEvent('course-document-saved'));
    }catch(error){if(!resource.uploaded&&error.status===403){CourseService.setAdminKey('');auth.hidden=false;}status.textContent=error.message||'保存失败，修改内容已保留';}
    finally{saving=false;save.disabled=false;editor.querySelector('[data-cancel-markdown]').disabled=false;}
   };
  };
 }
 window.CourseMarkdownEditor={attach};
})();
