"""Optional browser verification against local server or TEST_URL."""
import os
from pathlib import Path
from urllib.parse import unquote
from playwright.sync_api import sync_playwright, expect

base = os.getenv('TEST_URL', 'http://localhost:4173').rstrip('/')
out = Path(__file__).resolve().parent.parent / 'artifacts'
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    options = {'headless': True}
    if os.getenv('BROWSER_EXECUTABLE'):
        options['executable_path'] = os.environ['BROWSER_EXECUTABLE']
    browser = p.chromium.launch(**options)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/')
    page.wait_for_load_state('networkidle')
    courses = page.evaluate('window.COURSES')
    config = page.evaluate('window.SITE_CONFIG')
    expect(page.locator('.course-card')).to_have_count(len(courses))
    assert len(courses) == 23
    assert config['documentCount'] == 120
    assert sum(c['fileCount'] for c in courses) == 488
    assert '示例教师' not in page.locator('main').inner_text()
    page.screenshot(path=str(out / 'desktop.png'), full_page=True)
    page.get_by_role('searchbox').fill('Java GUI16')
    expect(page.locator('.course-card')).to_have_count(1)
    page.get_by_role('button', name='课程实习', exact=True).click()
    expect(page.locator('.course-card')).to_have_count(0)
    page.get_by_role('button', name='重置筛选').click()
    page.get_by_role('button', name='课程实习', exact=True).click()
    expect(page.locator('.course-card')).to_have_count(sum(c['category'] == '课程实习' for c in courses))
    page.get_by_role('button', name='重置筛选').click()
    page.get_by_role('button', name='收藏Java程序设计', exact=True).click()
    page.locator('[data-nav="bookmarks"]').click()
    expect(page.locator('.course-card')).to_have_count(1)
    page.reload()
    expect(page.locator('.course-card')).to_have_count(1)
    page.get_by_role('link', name='Java程序设计', exact=True).click()
    expect(page.get_by_role('heading', name='Java程序设计', exact=True)).to_be_visible()
    assert 'null 学分' not in page.locator('main').inner_text()
    page.get_by_role('tab', name='学习资料', exact=False).click()
    href = page.get_by_role('link', name='查看原始文件', exact=False).first.get_attribute('href')
    assert 'NWAFU-coursework-experimental-report/blob/' + config['sourceRevision'] in href
    assert 'Java程序设计' in unquote(href)
    page.get_by_role('button', name='报告失效 / 纠错').first.click()
    expect(page.locator('[name="title"]')).to_have_value('资料反馈：GUI-实验报告')
    page.get_by_role('button', name='关闭', exact=True).click()
    page.get_by_role('tab', name='修课经验 0').click()
    expect(page.get_by_role('heading', name='修课经验，等你补上')).to_be_visible()
    page.get_by_role('tab', name='课程问答 0').click()
    expect(page.get_by_role('heading', name='好问题，是学习的开始')).to_be_visible()
    page.get_by_role('button', name='分享课程资料', exact=False).click()
    page.locator('[name="title"]').fill('补充 Java 学习资料')
    page.locator('[name="semester"]').fill('2026 秋季')
    page.locator('[name="teacher"]').fill('待核实')
    page.locator('[name="content"]').fill('用于验证资料投稿流程的测试文稿，不会提交到 GitHub。')
    page.locator('[name="url"]').fill('https://example.com/notes')
    page.locator('[name="source"]').fill('测试原创')
    page.get_by_role('button', name='生成投稿文稿').click()
    draft = page.locator('#submission-result textarea').input_value()
    assert 'Java程序设计' in draft and 'https://example.com/notes' in draft
    assert page.locator('#github-submit').get_attribute('href').startswith('https://github.com/runawayaway/kejian-course-library/issues/new?')
    with page.expect_download() as info:
        page.get_by_role('button', name='下载 Markdown').click()
    assert info.value.suggested_filename == 'kejian-contribution.md'
    page.get_by_role('button', name='关闭', exact=True).click()
    page.get_by_role('button', name='提出课程问题').click()
    assert not page.locator('[name="url"]').evaluate('(e) => e.required')
    page.keyboard.press('Escape')
    page.goto(base + '/#/course/database-systems')
    page.get_by_role('tab', name='学习资料', exact=False).click()
    expect(page.get_by_role('link', name='DOCX 格式', exact=False)).to_have_count(5)
    page.reload()
    expect(page.get_by_role('heading', name='数据库系统概论', exact=True)).to_be_visible()
    page.screenshot(path=str(out / 'course.png'), full_page=True)
    tree_path = out / 'source-tree.json'
    if tree_path.exists():
        import json
        paths = {e['path'] for e in json.loads(tree_path.read_text(encoding='utf-8'))['tree']}
        for c in courses:
            for r in c['resources']:
                if r.get('sourcePath'):
                    assert r['sourcePath'] in paths
                for v in r.get('variants', []):
                    assert v['sourcePath'] in paths
    for width in [390, 768, 1024]:
        page.set_viewport_size({'width': width, 'height': 844})
        page.goto(base + '/')
        page.wait_for_load_state('networkidle')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'overflow at {width}'
        if width == 390:
            page.screenshot(path=str(out / 'mobile.png'), full_page=True)
            page.locator('#header-contribute').click()
            expect(page.get_by_role('dialog')).to_be_visible()
            page.keyboard.press('Escape')
    page.goto(base + '/#/missing')
    expect(page.get_by_role('heading', name='这门课还没收录')).to_be_visible()
    assert not errors, errors
    browser.close()
    print('PASS: 23 real courses, 120 document groups, source paths/formats, search, filters, persistence, drafts, downloads and responsive layouts; no browser errors.')
