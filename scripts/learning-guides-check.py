"""Check curated knowledge, local downloads and separation from real reviews."""
import os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
front=os.getenv('TEST_URL','http://localhost:4173').rstrip('/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
 context=b.new_context(viewport={'width':1360,'height':1000},color_scheme='dark')
 context.route('**/api/contributions',lambda r:r.abort())
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(front+'/#/course/operating-systems?tab=guides')
 expected=page.evaluate('LEARNING_GUIDE_DATA.guides.flatMap(g=>g.courseIds.map(id=>({id,title:g.title,sources:g.sourceIds.length})))')
 assert len(expected)==23
 for row in expected:
  page.goto(front+'/#/course/'+row['id']+'?tab=guides')
  expect(page.locator('.guide-intro h2')).to_have_text(row['title'])
  expect(page.locator('.guide-steps li')).to_have_count(3)
  expect(page.locator('.guide-sources article')).to_have_count(row['sources'])
  assert page.locator('.community-record').count()==0
  for link in page.locator('.guide-sources h4 a').all():assert link.get_attribute('href').startswith('https://')
 page.goto(front+'/#/course/operating-systems?tab=experiences')
 expect(page.locator('.community-record')).to_have_count(1)
 expect(page.locator('.community-record')).to_contain_text('课程成绩组成为平时：期末为3:7，三学分')
 page.get_by_role('tab',name='学习指引',exact=True).click()
 assert page.url.endswith('?tab=guides')
 page.reload();expect(page.get_by_role('tab',name='学习指引',exact=True)).to_have_attribute('aria-selected','true')
 page.get_by_role('button',name='阅读完整指引',exact=True).click()
 expect(page.locator('#preview-content .markdown-preview')).to_contain_text('不是本校学生修课记录')
 expect(page.locator('#preview-content .markdown-preview')).to_contain_text('https://pages.cs.wisc.edu/~remzi/OSTEP/')
 page.keyboard.press('Escape')
 with page.expect_download() as download:page.get_by_role('link',name='下载中文指引（Markdown）',exact=True).click()
 assert download.value.suggested_filename=='operating-systems.md'
 page.get_by_role('tab',name=re.compile('^资料 ')).click();expect(page.locator('.resource-row').filter(has_text='课间原创整理')).to_have_count(1)
 if os.getenv('CHECK_GUIDE_FEEDBACK')=='1':
  api=os.environ['API_TEST_URL'].rstrip('/')
  page.locator('.resource-row').filter(has_text='课间原创整理').get_by_role('button',name='反馈问题',exact=True).click()
  page.locator('#feedback-dialog textarea').fill('通用指引反馈流程验证，完成后删除。')
  with page.expect_response(lambda r:r.url==api+'/api/entries' and r.request.method=='POST') as response:page.get_by_role('button',name='提交反馈',exact=True).click()
  assert response.value.status==201,response.value.text()
  record=response.value.json()['record']
  try:assert record['sourceUrl']==api+'/materials/guides/operating-systems.md'
  finally:assert context.request.delete(api+'/api/entries/'+record['id'],headers={'X-Device-Key':page.evaluate('CourseService.recoveryCode()')}).ok
  page.keyboard.press('Escape')
 page.get_by_role('tab',name=re.compile('^资料 ')).press('End');expect(page.get_by_role('tab',name='学习指引',exact=True)).to_have_attribute('aria-selected','true')
 assert page.evaluate('LearningGuides.attach({id:"temporary-math",name:"高等数学",resources:[]}).guide.id')=='calculus-foundations'
 Path('artifacts').mkdir(exist_ok=True);page.screenshot(path='artifacts/learning-guide-desktop.png',full_page=True)
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='artifacts/learning-guide-mobile.png',full_page=True)
 page.goto(front+'/#/');page.get_by_role('searchbox').fill('乱序');expect(page.locator('.course-card')).to_have_count(1)
 page.get_by_role('link',name='我的投稿',exact=True).click();expect(page.locator('[data-delete]')).to_have_count(0)
 assert not errors,errors
 print('PASS: 23 course guides, preserved real experience, source attribution, real Markdown preview/download, refresh/deep links, keyboard navigation, topic search, math matching and dark mobile layout; works without API.')
 b.close()
