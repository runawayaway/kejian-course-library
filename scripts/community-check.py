"""Test actual issue recovery, refresh, review states and offline persistence."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base=os.getenv('TEST_URL','http://localhost:4173').rstrip('/')
root=Path(__file__).resolve().parent.parent
snapshot=json.loads((root/'data/community.json').read_text(encoding='utf-8'))
record=snapshot['records'][0]
def issue(number, teacher, semester, owner=True, topics='学习方法、授课与考核'):
    return {'number':number,'title':'[修课经验] '+('课程所占学分' if number==1 else '另一学期的经历'),
      'body':f'## 修课经验\n\n- 课程：操作系统\n- 学期：{semester}\n- 授课教师：{teacher}\n- 内容包含：{topics}\n\n## 具体内容\n\n'+(record['body'] if number==1 else '<img src=x onerror=alert(1)>另一学期的独立经历，不代表其他班级。')+'\n\n---\n投稿文稿',
      'user':{'login':'runawayaway' if owner else 'student'},'author_association':'OWNER' if owner else 'NONE','labels':[],'created_at':'2026-10-20T12:26:23Z'}
with sync_playwright() as p:
    options={'headless':True}
    if os.getenv('BROWSER_EXECUTABLE'):options['executable_path']=os.environ['BROWSER_EXECUTABLE']
    browser=p.chromium.launch(**options)
    page=browser.new_page(viewport={'width':1280,'height':960})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    records=[issue(1,record['teacher'],record['semester'])]
    offline=False
    def api(route):
        if offline:route.fulfill(status=403,body='{}',content_type='application/json')
        else:route.fulfill(status=200,body=json.dumps(records,ensure_ascii=False),content_type='application/json')
    page.route('https://api.github.com/repos/runawayaway/kejian-course-library/issues?*',api)
    page.goto(base+'/#/course/operating-systems')
    expect(page.get_by_role('status').first).to_contain_text('已读取最新 GitHub 投稿')
    expect(page.locator('.teaching-references')).to_contain_text(record['body'])
    expect(page.locator('.teaching-references')).to_contain_text('李长悦')
    expect(page.locator('.teaching-references')).to_contain_text('2025-2026春季')
    page.screenshot(path=str(root/'artifacts/operating-systems.png'),full_page=True)
    page.get_by_role('tab',name='修课经验 1').click()
    expect(page.locator('.community-record')).to_have_count(1)
    expect(page.locator('.community-record')).to_contain_text(record['body'])
    page.reload()
    expect(page.locator('.teaching-references')).to_contain_text(record['body'])
    # A different user's unreviewed report remains visible, with its own context.
    records.append(issue(2,'另一个教师','2024春季',owner=False))
    page.get_by_role('button',name='刷新课程投稿',exact=True).click()
    expect(page.get_by_role('tab',name='修课经验 2')).to_be_visible()
    expect(page.locator('.teaching-references')).not_to_contain_text('另一个教师')
    page.get_by_role('tab',name='修课经验 2').click()
    expect(page.locator('.community-record')).to_have_count(2)
    expect(page.locator('.community-record').nth(1)).to_contain_text('待核实投稿')
    expect(page.locator('.community-record').nth(1)).to_contain_text('2024春季')
    expect(page.locator('.community-record img')).to_have_count(0)
    # Accepted second report appears alongside, never replaces the first record.
    records[1]['labels']=[{'name':'已收录'}]
    page.get_by_role('button',name='刷新课程投稿',exact=True).click()
    expect(page.get_by_role('status').first).to_contain_text('已读取最新 GitHub 投稿')
    page.get_by_role('tab',name='课程介绍').click()
    expect(page.locator('.teaching-references .community-record')).to_have_count(2)
    expect(page.locator('.teaching-references')).to_contain_text('李长悦')
    expect(page.locator('.teaching-references')).to_contain_text('另一个教师')
    # Offline reload must still recover the owner's published record.
    offline=True
    page.reload()
    expect(page.get_by_role('status').first).to_contain_text('暂时无法读取最新投稿')
    expect(page.locator('.teaching-references')).to_contain_text(record['body'])
    page.get_by_role('button',name='补充授课与考核经历').click()
    expect(page.locator('#experience-topics')).to_be_visible()
    page.locator('[name="title"]').fill('考核经历')
    page.locator('[name="teacher"]').fill('测试教师')
    page.locator('[name="semester"]').fill('2026春季')
    page.locator('[name="content"]').fill('记录课堂安排与考核经历，不提交到 GitHub。')
    page.get_by_role('button',name='生成投稿文稿').click()
    assert '- 内容包含：学习方法、授课与考核' in page.locator('#submission-result textarea').input_value()
    expect(page.locator('#submission-result')).to_contain_text('Create')
    page.keyboard.press('Escape')
    page.set_viewport_size({'width':390,'height':844})
    page.reload()
    expect(page.locator('.teaching-references')).to_contain_text(record['body'])
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    browser.close()
    print('PASS: original OS issue visible in both views, refresh/new report, review separation, teacher/semester preservation, escaped content and offline fallback.')
