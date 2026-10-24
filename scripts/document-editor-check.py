"""Real edit/save/read checks; only temporary data is changed and is cleaned in finally."""
import os,json,time,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
front=os.getenv('TEST_URL','http://localhost:8096').rstrip('/')
api=os.getenv('API_TEST_URL',front).rstrip('/')
envfile=Path('.env.backend-admin' if 'chatgpt.site' in api else '.env.container')
values=dict(line.split('=',1) for line in envfile.read_text(encoding='utf-8-sig').splitlines() if '=' in line and not line.startswith('#'))
admin=values.get('ADMIN_KEY') or values.get('CONTAINER_ADMIN_KEY') or values.get('BACKEND_ADMIN_KEY')
assert admin,'Administrator credential missing'
headers={'X-Admin-Key':admin,'X-Device-Key':'b'*64};created=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe');ctx=b.new_context(viewport={'width':1360,'height':960});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  req=ctx.request.post(api+'/api/entries',headers=headers,data={'kind':'course','name':'原文编辑验证-'+str(int(time.time())),'content':'临时测试，完成后删除。'});assert req.status==201,req.text();course=req.json()['id'];created.append(course)
  page.goto(front);page.wait_for_function('window.CourseMarkdownEditor && window.LearningGuides')
  resource={'title':'操作系统学习指引','format':'MD','url':'materials/guides/operating-systems.md','courseId':course}
  page.evaluate('r=>CoursePreview.open(r)',resource);page.locator('#edit-markdown').click();area=page.get_by_role('textbox',name='Markdown 原文');expect(area).to_contain_text('') if False else None
  assert '操作系统' in area.input_value()
  revised='# 当前课程修订\n\n适用本课程的 **修订内容**。\n\n```c\nint value = 42;\n```\n'
  area.fill(revised);page.get_by_role('button',name='预览效果',exact=True).click();expect(page.locator('.markdown-draft-preview h1')).to_have_text('当前课程修订');page.get_by_role('button',name='继续编辑',exact=True).click()
  page.get_by_role('button',name='保存修改',exact=True).click();expect(page.locator('.markdown-editor [role=status]')).to_contain_text('请填写维护者密钥')
  page.locator('.markdown-admin input').fill(admin)
  with page.expect_response(lambda r:r.url==api+'/api/documents' and r.request.method=='PUT') as res:page.get_by_role('button',name='保存修改',exact=True).click()
  assert res.value.status==201,res.value.text();doc=res.value.json();created.insert(0,doc['id']);expect(page.locator('#preview-note')).to_contain_text('修改已保存')
  expect(page.locator('#preview-content h1')).to_have_text('当前课程修订')
  download=ctx.request.get(api+'/api/documents/'+doc['id']);assert download.body()==revised.encode()
  public=ctx.request.get(api+'/api/contributions').json();assert not public['admin'];saved=next(d for d in public['documents'] if d['id']==doc['id']);assert not saved['editable'] and 'content' not in saved
  other=b.new_context();otherpage=other.new_page();otherpage.goto(front);otherpage.wait_for_function('window.LearningGuides')
  merged=otherpage.evaluate('args=>LearningGuides.applyDocuments({id:args.id,resources:[{url:"materials/guides/operating-systems.md",format:"MD"}]},args.docs).resources[0]',{'id':course,'docs':public['documents']});assert merged['documentId']==doc['id']
  untouched=otherpage.evaluate('args=>LearningGuides.applyDocuments({id:"operating-systems",resources:[{url:"materials/guides/operating-systems.md",format:"MD"}]},args).resources[0]',public['documents']);assert 'documentId' not in untouched
  denied=ctx.request.put(api+'/api/documents',headers={'X-Device-Key':'c'*64},data={'courseId':course,'sourceUrl':resource['url'],'title':'test','content':'bad','version':doc['version']});assert denied.status==403
  stale=ctx.request.put(api+'/api/documents',headers=headers,data={'courseId':course,'sourceUrl':resource['url'],'title':'test','content':'bad','version':0});assert stale.status==409
  # Conflict must leave the unsaved editor draft intact.
  page.locator('#edit-markdown').click();area.fill('# 未保存草稿')
  updated=ctx.request.put(api+'/api/documents',headers=headers,data={'courseId':course,'sourceUrl':resource['url'],'title':resource['title'],'content':revised+'\n另一设备已更新','version':doc['version']});assert updated.status==200
  page.get_by_role('button',name='保存修改',exact=True).click();expect(page.locator('.markdown-editor [role=status]')).to_contain_text('已被修改');assert area.input_value()=='# 未保存草稿'
  page.set_viewport_size({'width':390,'height':844});page.evaluate("document.documentElement.dataset.theme='dark'");assert page.locator('#preview-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth')
  Path('artifacts').mkdir(exist_ok=True);page.screenshot(path='artifacts/document-editor-mobile.png')
  page.keyboard.press('Escape');expect(page.locator('#preview-content>*')).to_have_count(0)
  # The uploader can edit their own Markdown without a maintainer key.
  ownkey=page.evaluate('CourseService.recoveryCode()');ownheaders={'X-Device-Key':ownkey}
  upload=ctx.request.post(api+'/api/entries',headers=ownheaders,multipart={'metadata':json.dumps({'kind':'resource','courseId':course,'category':'学习笔记'}),'file':{'name':'自己的笔记.md','mimeType':'text/markdown','buffer':b'# old'}});assert upload.status==201
  own=upload.json()['record'];created.insert(0,own['id']);page.evaluate("CourseService.setAdminKey('')")
  page.evaluate('r=>CoursePreview.open({...r,url:CourseService.fileUrl(r.downloadPath)})',own);page.locator('#edit-markdown').click();expect(page.locator('.markdown-admin')).to_be_hidden();page.get_by_role('textbox',name='Markdown 原文').fill('# 自己修改的新内容')
  page.get_by_role('button',name='保存修改',exact=True).click();expect(page.locator('#preview-note')).to_contain_text('修改已保存');expect(page.locator('#preview-content h1')).to_have_text('自己修改的新内容')
  assert ctx.request.get(api+own['downloadPath']).body()=='# 自己修改的新内容'.encode()
  if 'localhost' in api:
   # Verify a real course guide tab switches to the saved Markdown, then remove the test revision.
   before=ctx.request.get(api+'/api/contributions').json();assert not any(d['courseId']=='operating-systems' for d in before['documents'])
   revision=ctx.request.put(api+'/api/documents',headers=headers,data={'courseId':'operating-systems','sourceUrl':resource['url'],'title':'操作系统学习指引','content':revised,'version':0});assert revision.status==201
   created.insert(0,revision.json()['id']);page.goto(front+'/#/course/operating-systems?tab=guides');page.reload();expect(page.locator('.guide-revised h1')).to_have_text('当前课程修订',timeout=20000)
   page.get_by_role('button',name='阅读 / 编辑原文',exact=True).click();expect(page.locator('#preview-content h1')).to_have_text('当前课程修订')
  other.close();assert not errors,errors
  print('PASS: edit original, draft rendering, credential enforcement, public persistence/download, cross-course isolation, concurrent conflict and retained mobile draft.')
 finally:
  for entry in created:
   result=ctx.request.delete(api+'/api/entries/'+entry,headers=headers);assert result.ok,result.text()
  b.close()
