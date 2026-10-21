"""Test the simplified site. GitHub write pages are intercepted; no test Issues are created."""
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parent.parent
base=os.getenv('TEST_URL','http://localhost:4173').rstrip('/')
snapshot=json.loads((root/'data/community.json').read_text(encoding='utf-8'))
original=next(r for r in snapshot['records'] if r['number']==1)
def issue(number,title,body,owner=False):
    return {'number':number,'title':title,'body':body,'user':{'login':'runawayaway' if owner else 'student'},'author_association':'OWNER' if owner else 'NONE','labels':[],'created_at':'2026-10-21T14:00:00Z'}
records=[issue(1,'[修课经验] '+original['title'],f"## 修课经验\n\n- 课程：操作系统\n- 学期：{original['semester']}\n- 授课教师：{original['teacher']}\n\n## 具体内容\n\n{original['body']}\n",True)]
with sync_playwright() as p:
    options={'headless':True}
    if os.getenv('BROWSER_EXECUTABLE'):options['executable_path']=os.environ['BROWSER_EXECUTABLE']
    browser=p.chromium.launch(**options)
    context=browser.new_context(viewport={'width':1440,'height':1000})
    context.route('https://github.com/**',lambda route:route.fulfill(status=200,body='<html>GitHub confirmation intercepted for testing</html>',content_type='text/html'))
    page=context.new_page()
    page.clock.install()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    offline=False
    def api(route):
        route.fulfill(status=403 if offline else 200,body='{}' if offline else json.dumps(records,ensure_ascii=False),content_type='application/json')
    page.route('https://api.github.com/repos/runawayaway/kejian-course-library/issues?*',api)
    def settle():expect(page.locator('.sync-bar [role=status]')).to_have_text('已同步')
    def submit():
        with page.expect_popup() as info:page.get_by_role('button',name='继续到 GitHub',exact=True).click()
        popup=info.value;popup.wait_for_load_state();data=parse_qs(urlparse(popup.url).query);popup.close();return data
    def return_to_site():
        page.clock.fast_forward(21000)
        page.evaluate('window.dispatchEvent(new Event("focus"))')
    page.goto(base+'/');settle()
    expect(page.locator('.course-card')).to_have_count(23)
    expect(page.get_by_role('link',name='共建指南')).to_have_count(0)
    expect(page.get_by_role('button',name='生成投稿文稿')).to_have_count(0)
    (root/'artifacts').mkdir(exist_ok=True)
    page.screenshot(path=str(root/'artifacts/desktop.png'),full_page=True)
    page.get_by_role('searchbox').fill('Java GUI16')
    expect(page.locator('.course-card')).to_have_count(1)
    page.get_by_role('searchbox').fill('')
    page.get_by_role('button',name='有经验',exact=True).click()
    expect(page.locator('.course-card')).to_have_count(1)
    page.get_by_role('button',name='全部',exact=True).click()
    page.get_by_role('button',name='收藏操作系统',exact=True).click()
    page.locator('[data-nav=bookmarks]').click()
    expect(page.locator('.course-card')).to_have_count(1)
    page.reload();settle()
    expect(page.locator('.course-card')).to_have_count(1)
    page.get_by_role('link',name='操作系统',exact=True).click()
    expect(page.locator('.community-record')).to_contain_text(original['body'])
    expect(page.locator('.community-record')).to_contain_text('李长悦')
    expect(page.get_by_role('link',name='修改原文')).to_have_attribute('href',original['url'])
    expect(page.get_by_role('tab',name='课程问答',exact=False)).to_have_count(0)
    # Editing an original GitHub record updates in place without another form.
    records[0]['body']=records[0]['body'].replace(original['body'],'修改后的考核经历：平时 30%，期末 70%。')
    return_to_site()
    expect(page.locator('.community-record')).to_contain_text('修改后的考核经历')
    # Experience: only the content is required when opened within a course.
    page.get_by_role('button',name='写经验',exact=True).click()
    expect(page.locator('[name=course]')).to_have_value('operating-systems')
    assert not page.locator('[name=teacher]').evaluate('(e)=>e.required')
    assert not page.locator('[name=semester]').evaluate('(e)=>e.required')
    page.locator('[name=content]').fill('这门课建议每周整理实验记录。')
    draft=submit()
    assert '课程ID：operating-systems' in draft['body'][0]
    assert '授课教师：未注明' in draft['body'][0]
    expect(page.get_by_role('dialog')).to_be_visible()
    # No Issue is created merely by opening its confirmation page.
    return_to_site();settle();expect(page.get_by_role('dialog')).to_be_visible()
    records.append(issue(2,draft['title'][0],draft['body'][0]))
    return_to_site()
    expect(page.get_by_role('dialog')).not_to_be_visible()
    expect(page.get_by_role('tab',name='经验与考核 2')).to_have_attribute('aria-selected','true')
    expect(page.locator('.community-record').last).to_contain_text('待核实')
    # Student adds a course using the name alone; everyone can then attach content.
    page.get_by_role('button',name='添加课程',exact=False).first.click()
    page.locator('[name=name]').fill('计算机图形学')
    new_course=submit()
    records.append(issue(3,new_course['title'][0],new_course['body'][0]))
    return_to_site()
    expect(page.get_by_role('heading',name='计算机图形学',exact=True)).to_be_visible()
    expect(page.get_by_role('dialog')).not_to_be_visible()
    assert 'student-3' in page.url
    # Source link sharing also syncs, rather than requiring manual source edits.
    page.get_by_role('button',name='分享资料链接',exact=True).click()
    page.locator('[name=url]').fill('https://example.com/graphics')
    shared=submit();records.append(issue(4,shared['title'][0],shared['body'][0]))
    return_to_site()
    expect(page.get_by_role('tab',name='资料 1')).to_have_attribute('aria-selected','true')
    expect(page.locator('.resource-body h2 a')).to_have_attribute('href','https://example.com/graphics')
    # Full reload retains community course; duplicate submission opens the existing one.
    page.reload();settle()
    expect(page.get_by_role('heading',name='计算机图形学',exact=True)).to_be_visible()
    page.get_by_role('button',name='添加课程',exact=False).first.click()
    page.locator('[name=name]').fill('计算机 图形学')
    page.get_by_role('button',name='继续到 GitHub',exact=True).click()
    expect(page.get_by_role('dialog')).not_to_be_visible()
    expect(page.get_by_role('heading',name='计算机图形学',exact=True)).to_be_visible()
    # Empty courses can receive experiences without teacher/semester fields.
    page.get_by_role('button',name='写经验',exact=True).click()
    page.locator('[name=content]').fill('<img src=x onerror=alert(1)>课程建议先掌握线性代数。')
    experience=submit();records.append(issue(5,experience['title'][0],experience['body'][0]))
    return_to_site()
    expect(page.locator('.community-record')).to_contain_text('线性代数')
    expect(page.locator('.community-record img')).to_have_count(0)
    # Snapshot restores the actual OS report even when the API is unavailable.
    offline=True
    page.goto(base+'/#/course/operating-systems');page.reload()
    expect(page.locator('.community-record')).to_contain_text(original['body'])
    expect(page.locator('.sync-bar [role=status]')).to_contain_text('同步暂不可用')
    page.get_by_role('button',name='分享资料链接',exact=True).click()
    page.locator('[name=url]').fill('ftp://example.com/notes')
    page.get_by_role('button',name='继续到 GitHub',exact=True).click()
    assert page.locator('[name=url]').evaluate('(e)=>!e.validity.valid')
    page.keyboard.press('Escape')
    page.get_by_role('button',name='添加课程',exact=False).first.click()
    page.locator('[name=name]').fill('表单验证课程')
    assert page.locator('#contribution-form').evaluate('(e)=>e.checkValidity()')
    page.keyboard.press('Escape')
    for width in [390,768,1024]:
        page.set_viewport_size({'width':width,'height':844});page.goto(base+'/')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),str(width)
        if width==390:
            page.screenshot(path=str(root/'artifacts/mobile.png'),full_page=True)
            page.get_by_role('button',name='添加课程',exact=False).first.click()
            expect(page.get_by_role('dialog')).to_be_visible();page.keyboard.press('Escape')
    assert not errors,errors
    browser.close()
    print('PASS: simplified UI, existing OS report, direct submission, optional context, new student course, duplicate prevention, shared link, auto updates, bookmarks, escaped content and offline fallback.')
