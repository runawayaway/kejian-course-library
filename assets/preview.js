/* Public document reader; downloaded content is never inserted as HTML. */
(() => {
  const textFormats=new Set(['TXT','MD','CSV','TSV','IPYNB','C','CPP','H','JAVA','PY','SQL','R','JS','JSON']);
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
        const pre=document.createElement('pre');pre.textContent=result.value;body.replaceChildren(pre);
        note.textContent=result.truncated?'文件较长，预览显示前 1 MB 文本；下载可查看完整内容。':'文本预览';
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
