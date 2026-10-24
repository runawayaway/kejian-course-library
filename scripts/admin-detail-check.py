"""Exercise actual maintainer login and editing entrances within course pages."""
import os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
front=os.getenv('TEST_URL','http://localhost:8096').rstrip('/')
values=dict(line.split('=',1) for line in Path('.env.backend-admin' if front.startswith('https:') else '.env.container').read_text(encoding='utf-8-sig').splitlines() if '=' in line and not line.startswith('#'))
admin=values.get('ADMIN_KEY') or values.get('CONTAINER_ADMIN_KEY')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe');page=b.new_page(viewport={'width':1360,'height':960})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(front+'/#/course/operating-systems?tab=experiences');expect(page.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000)
 page.locator('#manage-access').click();page.locator('#admin-form input').fill(admin);page.locator('#admin-form [type=submit]').click()
 expect(page.locator('#admin-dialog')).not_to_be_visible();expect(page.locator('.admin-course-state')).to_be_visible()
 # Original imported experience is prefilled, not a blank new submission.
 original=page.locator('.community-record .preserve-lines').first.inner_text()
 page.locator('[data-edit-record]').first.click();expect(page.locator('#dialog-title')).to_have_text('修改经验');expect(page.locator('#contribution-form [name=content]')).to_have_value(original)
 page.locator('#close-dialog').click()
 page.get_by_role('tab',name=re.compile('^资料 ')).click()
 row=page.locator('.resource-row').filter(has_text='课间原创整理')
 row.get_by_role('button',name='编辑原文',exact=True).click();expect(page.get_by_role('textbox',name='Markdown 原文')).to_be_visible();assert '操作系统' in page.get_by_role('textbox',name='Markdown 原文').input_value()
 expect(page.locator('.markdown-admin')).to_be_hidden();page.keyboard.press('Escape');expect(page.locator('#preview-content>*')).to_have_count(0)
 page.get_by_role('tab',name='学习指引',exact=True).click();page.locator('#edit-learning-guide').click();expect(page.get_by_role('textbox',name='Markdown 原文')).to_be_visible()
 page.keyboard.press('Escape');page.reload();expect(page.locator('.admin-course-state')).to_be_visible(timeout=20000)
 page.get_by_role('tab',name=re.compile('^经验与考核 ')).click();page.locator('.experience-edit-title').first.click();expect(page.locator('#dialog-title')).to_have_text('修改经验')
 page.screenshot(path='artifacts/admin-course-edit.png')
 assert not errors,errors;b.close()
print('PASS: actual administrator login, original experience prefill/title editing, direct resource/guide source editing, no repeat key and role persists after refresh.')
