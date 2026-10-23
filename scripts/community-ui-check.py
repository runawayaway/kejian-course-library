"""Real API/browser checks for contribution recovery, filters and maintenance."""
import json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
front=os.getenv('TEST_URL','http://localhost:4173').rstrip('/')
api=os.getenv('API_TEST_URL','http://127.0.0.1:8788').rstrip('/')
admin=os.getenv('ADMIN_KEY','local-test-admin-key')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
 def new_context():
  c=b.new_context(viewport={'width':1360,'height':960})
  if os.getenv('USE_SITE_CONFIG')!='1':c.route('**/assets/runtime-config.js*',lambda r:r.fulfill(content_type='text/javascript',body='window.API_BASE='+json.dumps(api)))
  return c
 c=new_context();page=c.new_page();created=[];key='';name='共享流程验证-'+str(int(time.time()));filename=name+'.md'
 try:
  page.goto(front);expect(page.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000)
  key=page.evaluate('CourseService.recoveryCode()');headers={'X-Device-Key':key}
  course=c.request.post(api+'/api/entries',headers=headers,data={'kind':'course','name':name}).json()['record'];created.append(course['id'])
  experience=c.request.post(api+'/api/entries',headers=headers,data={'kind':'experience','courseId':course['id'],'content':'学习建议：先完成实验，再整理复习提纲。','teacher':'经验教师','semester':'2025秋'}).json()['record'];created.append(experience['id'])
  page.goto(front+'/#/course/'+course['id']+'?tab=resources');page.reload();expect(page.get_by_role('heading',name=name,exact=True)).to_be_visible(timeout=30000)
  page.get_by_role('button',name='上传资料',exact=True).click()
  page.locator('[name=file]').set_input_files({'name':filename,'mimeType':'text/plain','buffer':'# 学习笔记\n可预览的资料'.encode()})
  page.locator('[name=category]').select_option('学习笔记')
  page.locator('#context-fields summary').click();page.locator('[name=teacher]').fill('验证教师');page.locator('[name=semester]').fill('2026秋')
  page.locator('[name=content]').fill('浏览器分类测试')
  with page.expect_response(lambda r:r.url==api+'/api/entries' and r.request.method=='POST') as uploaded:page.get_by_role('button',name='上传文件',exact=True).click()
  assert uploaded.value.status==201,uploaded.value.text()
  resource=uploaded.value.json()['record'];created.append(resource['id'])
  expect(page.locator('.resource-body h2')).to_contain_text(filename,timeout=30000)
  expect(page.locator('#contribution-form [type=submit]')).to_be_enabled(timeout=30000)
  page.locator('#content-category').select_option('复习资料');expect(page.locator('.resource-row')).to_have_count(0)
  page.locator('#content-category').select_option('学习笔记');page.locator('#content-teacher').select_option('验证教师');page.locator('#content-semester').select_option('2026秋');expect(page.locator('.resource-row')).to_have_count(1)
  page.get_by_role('tab',name='经验与考核 1',exact=True).click();expect(page.locator('.community-record')).to_contain_text('经验教师');expect(page.locator('.community-record')).to_have_count(1)
  page.get_by_role('tab',name='资料 1',exact=True).click();expect(page.locator('#content-teacher')).to_have_value('');expect(page.locator('.resource-row')).to_have_count(1)
  page.get_by_role('button',name='反馈问题',exact=True).click();page.locator('#feedback-dialog textarea').fill('验证反馈：'+name)
  with page.expect_response(lambda r:r.url==api+'/api/entries' and r.request.method=='POST') as feedback:page.get_by_role('button',name='提交反馈',exact=True).click()
  assert feedback.value.status==201;report=feedback.value.json()['record'];created.append(report['id'])
  expect(page.locator('#feedback-dialog [role=status]')).to_contain_text('已提交');page.keyboard.press('Escape')
  page.get_by_role('link',name='我的投稿',exact=True).click();expect(page.get_by_role('heading',name=filename,exact=True)).to_be_visible()
  page.get_by_role('button',name='备份 / 恢复投稿',exact=True).click();page.get_by_role('button',name='查看并备份恢复码',exact=True).click();expect(page.locator('#recovery-export textarea')).to_have_value(key);page.keyboard.press('Escape')
  second=new_context();other=second.new_page();other.goto(front+'/#/mine');expect(other.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000);expect(other.locator('[data-delete]')).to_have_count(0)
  other.get_by_role('button',name='备份 / 恢复投稿',exact=True).click();other.locator('#recovery-dialog [name=key]').fill(key);other.get_by_role('button',name='切换并恢复',exact=True).click()
  expect(other.get_by_role('heading',name=filename,exact=True)).to_be_visible(timeout=30000)
  assert other.evaluate('CourseService.recoveryCode()')==key
  manager=new_context();m=manager.new_page();m.goto(front);m.get_by_role('button',name='管理',exact=True).click();m.locator('#admin-form [name=key]').fill(admin);m.get_by_role('button',name='启用管理',exact=True).click();expect(m.locator('#admin-dialog')).not_to_be_visible(timeout=30000)
  m.get_by_role('link',name='我的投稿',exact=True).click();expect(m.get_by_role('heading',name='内容管理',exact=True)).to_be_visible()
  expect(m.locator('[data-resolve="'+report['id']+'"]')).to_be_visible()
  m.locator('[data-resolve="'+report['id']+'"]').click();expect(m.locator('[data-resolve="'+report['id']+'"]')).to_have_text('重新打开',timeout=30000)
  m.locator('[data-review="'+resource['id']+'"]').click();expect(m.locator('[data-review="'+resource['id']+'"]')).to_have_text('取消核实',timeout=30000)
  row=other.locator('.submission-row').filter(has=other.get_by_role('heading',name=filename,exact=True));row.get_by_role('button',name='修改',exact=True).click()
  expect(other.locator('[name=category]')).to_have_value('学习笔记');expect(other.locator('[name=teacher]')).to_have_value('验证教师')
  # Refresh the restored browser before editing content changed by the maintainer.
  other.keyboard.press('Escape');other.reload();expect(other.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000)
  other.locator('.submission-row').filter(has=other.get_by_role('heading',name=filename,exact=True)).get_by_role('button',name='修改',exact=True).click()
  other.locator('[name=content]').fill('另一台设备恢复后成功修改')
  other.get_by_role('button',name='保存修改',exact=True).click();expect(other.locator('.resource-description')).to_have_text('另一台设备恢复后成功修改',timeout=30000)
  expect(other.locator('#contribution-form [type=submit]')).to_be_enabled(timeout=30000)
  other.get_by_role('link',name='我的投稿',exact=True).click();other.set_viewport_size({'width':390,'height':844});assert other.evaluate('document.documentElement.scrollWidth<=innerWidth')
  Path('artifacts').mkdir(exist_ok=True);other.screenshot(path='artifacts/my-contributions-mobile.png',full_page=True)
  other.on('dialog',lambda d:d.accept());other.locator('[data-delete="'+resource['id']+'"]').click();expect(other.locator('[data-delete="'+resource['id']+'"]')).to_have_count(0,timeout=30000)
  assert c.request.get(api+resource['downloadPath']).status==404
  created.remove(resource['id'])
  page.goto(front+'/#/course/'+course['id']+'?tab=experiences');page.reload();expect(page.locator('.community-record')).to_contain_text('2025秋',timeout=30000)
  page.screenshot(path='artifacts/course-experience-filters.png',full_page=True)
  print('PASS: real categorized upload and filters, private feedback handling, admin verification, cross-browser recovery/edit/delete, context metadata and mobile layout.')
 finally:
  if key:
   for item in reversed(created):
    response=c.request.delete(api+'/api/entries/'+item,headers={'X-Device-Key':key})
    assert response.ok,'cleanup failed '+item
  b.close()
