/* Public document reader; Markdown HTML is sanitized before entering the document. */
(() => {
  const textFormats=new Set(['TXT','MD','MARKDOWN','CSV','TSV','IPYNB','C','CPP','H','JAVA','PY','SQL','R','JS','JSON']);
  const officeFormats=new Set(['DOC','DOCX','PPT','PPTX','XLS','XLSX']);
  let dialog,body,title,download,note,controller,objectUrl,serial=0;
  function fileUrl(value){
    const url=new URL(value,location.href);
    if(!['https:','http:'].includes(url.protocol))throw new Error('资料地址无效');
    if(url.hostname==='github.com'&&/^\/[^/]+\/[^/]+\/blob\//.test(url.pathname)){
      url.hostname='raw.githubusercontent.com';url.pathname=url.pathname.replace('/blob/','/');url.search='';
    }
    return url.href;
  }
  function cleanup(){serial++;controller?.abort();controller=null;body?.replaceChildren();if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}}
  function initialize(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='preview-dialog';dialog.setAttribute('aria-labelledby','preview-title');
    dialog.innerHTML='<div class="preview-heading"><h2 id="preview-title"></h2><a class="button secondary" id="preview-download" download target="_blank" rel="noopener noreferrer">下载文件</a><button class="icon-button" aria-label="关闭预览" type="button">×</button></div><p id="preview-note" role="status"></p><div id="preview-content"></div>';
    document.body.append(dialog);body=dialog.querySelector('#preview-content');title=dialog.querySelector('h2');download=dialog.querySelector('a');note=dialog.querySelector('[role=status]');
    dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',cleanup);
    dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}};
  }
  function frame(src,label){const element=document.createElement('iframe');element.title=label;element.src=src;element.referrerPolicy='no-referrer';body.replaceChildren(element);return element;}
  async function readText(response,signal){
    const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,value='',truncated=false;
    try{while(true){if(signal.aborted)throw new DOMException('Aborted','AbortError');const part=await reader.read();if(part.done)break;const remaining=1024*1024-size;value+=decoder.decode(part.value.subarray(0,remaining),{stream:true});size+=part.value.length;if(size>1024*1024){truncated=true;await reader.cancel();break;}}value+=decoder.decode();}
    finally{reader.releaseLock();}return {value,truncated};
  }
  function markdown(value,url){
    if(!window.marked||!window.DOMPurify)throw new Error('Markdown reader unavailable');
    const article=document.createElement('article');article.className='markdown-preview';
    const html=marked.parse(value.replace(/^\uFEFF/,''),{gfm:true,breaks:false,async:false});
    article.append(DOMPurify.sanitize(html,{
      RETURN_DOM_FRAGMENT:true,
      ALLOWED_TAGS:['h1','h2','h3','h4','h5','h6','p','br','hr','strong','em','del','s','blockquote','ul','ol','li','pre','code','a','img','table','thead','tbody','tr','th','td','details','summary','kbd','sup','sub'],
      ALLOWED_ATTR:['href','src','alt','title','start','colspan','rowspan'],
      ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false
    }));
    for(const el of article.querySelectorAll('a,img')){
      const attr=el.tagName==='A'?'href':'src',raw=el.getAttribute(attr);if(!raw)continue;
      try{
        const target=new URL(raw,url),allowed=el.tagName==='A'?['https:','http:','mailto:']:['https:','http:'];
        if(!allowed.includes(target.protocol))throw new Error('Unsafe URL');
        el.setAttribute(attr,target.href);
        if(el.tagName==='A'){el.target='_blank';el.rel='noopener noreferrer';}
        else{el.loading='lazy';el.referrerPolicy='no-referrer';}
      }catch{el.removeAttribute(attr);}
    }
    for(const table of article.querySelectorAll('table')){const scroll=document.createElement('div');scroll.className='markdown-table';table.replaceWith(scroll);scroll.append(table);}
    return article;
  }
  async function open(resource){
    initialize();cleanup();const requestId=serial;controller=new AbortController();const signal=controller.signal;
    title.textContent=resource.title||'资料预览';note.textContent='正在加载预览…';body.setAttribute('aria-busy','true');dialog.showModal();
    try{
      const url=fileUrl(resource.url),format=String(resource.format||'').toUpperCase();download.href=url;
      if(officeFormats.has(format)){
        note.textContent='由 Microsoft 在线预览；若加载失败，可下载文件查看。';
        frame('https://view.officeapps.live.com/op/embed.aspx?src='+encodeURIComponent(url),resource.title+' · Office 预览');return;
      }
      if(!['PDF','PNG','JPG','JPEG','GIF','WEBP'].includes(format)&&!textFormats.has(format)){
        note.textContent='这种格式暂不支持在线预览，请点击「下载文件」后查看。';return;
      }
      const response=await fetch(url,{signal});if(!response.ok)throw new Error('无法读取文件（'+response.status+'）');
      if(textFormats.has(format)){
        const result=await readText(response,signal);if(requestId!==serial)return;
        const isMarkdown=format==='MD'||format==='MARKDOWN';
        if(isMarkdown)body.replaceChildren(markdown(result.value,response.url||url));
        else{const pre=document.createElement('pre');pre.textContent=result.value;body.replaceChildren(pre);}
        note.textContent=result.truncated?'文件较长，预览显示前 1 MB 内容；下载可查看完整内容。':isMarkdown?'Markdown 阅读预览':'文本预览';
      }else{
        const blob=await response.blob();if(requestId!==serial)return;
        objectUrl=URL.createObjectURL(new Blob([blob],{type:format==='PDF'?'application/pdf':'image/'+(format==='JPG'?'jpeg':format.toLowerCase())}));
        if(format==='PDF'){frame(objectUrl,resource.title+' · PDF 预览');note.textContent='PDF 预览；若浏览器无法显示，可点击「下载文件」。';}
        else{const image=document.createElement('img');image.src=objectUrl;image.alt=resource.title;body.replaceChildren(image);note.textContent='图片预览';}
      }
    }catch(error){if(requestId===serial&&error.name!=='AbortError')note.textContent='预览加载失败，请点击「下载文件」查看。';}
    finally{if(requestId===serial)body.removeAttribute('aria-busy');}
  }
  window.CoursePreview={open,fileUrl};
})();
