"""Verify automatic refresh and GitHub return without publishing test Issues."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parent.parent
base=os.getenv('TEST_URL','http://localhost:4173').rstrip('/')
original=json.loads((root/'data/community.json').read_text(encoding='utf-8'))['records'][0]
def issue(number,title,content,teacher='李长悦',semester='2025-2026春季'):
    return {'number':number,'title':'[修课经验] '+title,'body':f'## 修课经验\n\n- 课程：操作系统\n- 学期：{semester}\n- 授课教师：{teacher}\n- 内容包含：授课与考核\n\n## 具体内容\n\n{content}\n\n---\n投稿',
       'user':{'login':'runawayaway'},'author_association':'OWNER','labels':[],'created_at':'2026-10-20T12:26:23Z'}
with sync_playwright() as p:
    opts={'headless':True}
    if os.getenv('BROWSER_EXECUTABLE'):opts['executable_path']=os.environ['BROWSER_EXECUTABLE']
    browser=p.chromium.launch(**opts)
    page=browser.new_page()
    page.clock.install()
    records=[issue(1,original['title'],original['body'])]
    requests=[]
    def api(route):
        requests.append(route.request.url)
        route.fulfill(status=200,content_type='application/json',body=json.dumps(records,ensure_ascii=False))
    page.route('https://api.github.com/repos/runawayaway/kejian-course-library/issues?*',api)
    page.goto(base+'/#/course/operating-systems')
    expect(page.locator('.teaching-references')).to_contain_text(original['body'])
    expect(page.get_by_role('status').first).to_contain_text('已读取最新 GitHub 投稿')
    # Modifying an existing GitHub Issue updates the original page on return.
    records[0]=issue(1,original['title'],'修改后的考核经历：这是修改同一个 Issue 的内容。')
    page.clock.fast_forward(21000)
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    expect(page.locator('.teaching-references')).to_contain_text('修改后的考核经历')
    expect(page.locator('.teaching-references')).not_to_contain_text(original['body'])
    # Automatic checks with no changes preserve the reading DOM.
    page.evaluate('window.savedPanel=document.querySelector(".teaching-references")')
    page.clock.fast_forward(21000)
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    expect(page.get_by_role('status').first).to_contain_text('已读取最新 GitHub 投稿')
    assert page.evaluate('window.savedPanel===document.querySelector(".teaching-references")')
    # A new record is visible after the automatic interval, without clicking refresh.
    records.append(issue(2,'定时更新测试','通过定时读取自动出现的修课经验。'))
    page.clock.fast_forward(120000)
    expect(page.get_by_role('tab',name='修课经验 2')).to_be_visible()
    # Track an actual outgoing draft, then recognize its incoming Issue on return.
    page.get_by_role('button',name='补充授课与考核经历').click()
    page.locator('[name="title"]').fill('新投稿自动返回课程')
    page.locator('[name="semester"]').fill('2026秋季')
    page.locator('[name="teacher"]').fill('测试教师')
    page.locator('[name="content"]').fill('模拟真实 GitHub 提交成功后切回网站的修课经验。')
    page.get_by_role('button',name='生成投稿文稿').click()
    page.locator('#github-submit').evaluate('(e)=>e.addEventListener("click",event=>event.preventDefault())')
    page.locator('#github-submit').click()
    assert page.evaluate('sessionStorage.getItem("kejian-pending-contribution")')
    expect(page.get_by_role('dialog')).to_be_visible()
    # Opening GitHub alone must never report success.
    page.clock.fast_forward(5000)
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    expect(page.get_by_role('dialog')).to_be_visible()
    records.append(issue(3,'新投稿自动返回课程','模拟真实 GitHub 提交成功后切回网站的修课经验。','测试教师','2026秋季'))
    page.clock.fast_forward(5000)
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    expect(page.get_by_role('dialog')).not_to_be_visible()
    expect(page.get_by_role('tab',name='修课经验 3')).to_have_attribute('aria-selected','true')
    expect(page.locator('.community-record')).to_have_count(3)
    assert page.evaluate('sessionStorage.getItem("kejian-pending-contribution")') is None
    assert len(requests)>=6
    browser.close()
    print('PASS: edited Issue updates original page on return, new record syncs on interval, unchanged DOM preserved, submitted draft recognized without false success.')
