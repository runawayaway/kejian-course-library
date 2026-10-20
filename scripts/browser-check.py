"""Optional end-to-end check: py -3.11 scripts/browser-check.py (requires Playwright)."""
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.getenv('TEST_URL', 'http://localhost:4173')
out = Path(__file__).resolve().parent.parent / 'artifacts'
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    launch = {'headless': True}
    if os.getenv('BROWSER_EXECUTABLE'):
        launch['executable_path'] = os.environ['BROWSER_EXECUTABLE']
    browser = p.chromium.launch(**launch)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    page.wait_for_load_state('networkidle')
    expect(page.locator('.course-card')).to_have_count(5)
    page.screenshot(path=str(out / 'desktop.png'), full_page=True)
    page.get_by_role('searchbox').fill('Docker')
    expect(page.locator('.course-card')).to_have_count(1)
    page.get_by_role('button', name='专业必修', exact=True).click()
    expect(page.locator('.course-card')).to_have_count(0)
    page.get_by_role('button', name='重置筛选').click()
    page.locator('#college-filter').select_option(label='数学学院')
    expect(page.locator('.course-card')).to_have_count(1)
    page.get_by_role('button', name='重置筛选').click()
    page.get_by_role('button', name='收藏虚拟化与容器技术', exact=True).click()
    page.locator('[data-nav="bookmarks"]').click()
    expect(page.locator('.course-card')).to_have_count(1)
    page.reload()
    expect(page.locator('.course-card')).to_have_count(1)
    page.get_by_role('link', name='虚拟化与容器技术', exact=True).click()
    page.get_by_role('tab', name='学习资料 2').click()
    with page.expect_download() as info:
        page.get_by_role('link', name='下载笔记').click()
    assert info.value.suggested_filename == 'docker-notes.md'
    page.get_by_role('button', name='报告失效 / 纠错').first.click()
    expect(page.get_by_role('dialog')).to_be_visible()
    expect(page.locator('[name="title"]')).to_have_value('资料反馈：Docker 入门：从镜像到 Compose')
    page.get_by_role('button', name='关闭', exact=True).click()
    page.get_by_role('tab', name='课程问答 1').click()
    page.get_by_role('button', name='♡ 对我有帮助', exact=True).click()
    expect(page.get_by_role('button', name='✓ 已标记有帮助')).to_have_attribute('aria-pressed', 'true')
    page.get_by_role('button', name='补充回答').click()
    expect(page.locator('[name="type"]')).to_have_value('answer')
    page.get_by_role('button', name='关闭', exact=True).click()
    page.get_by_role('button', name='分享课程资料', exact=False).click()
    page.locator('[name="title"]').fill('测试资料贡献')
    page.locator('[name="semester"]').fill('2026 秋季')
    page.locator('[name="teacher"]').fill('示例教师')
    page.locator('[name="content"]').fill('这是浏览器自动化测试的原创学习资料说明。')
    page.locator('[name="url"]').fill('https://example.com/notes')
    page.locator('[name="source"]').fill('本人原创')
    page.get_by_role('button', name='生成投稿文稿').click()
    expect(page.locator('#submission-result')).to_be_visible()
    draft = page.locator('#submission-result textarea').input_value()
    assert 'https://example.com/notes' in draft and '本人原创' in draft
    assert '虚拟化与容器技术' in draft
    with page.expect_download() as info:
        page.get_by_role('button', name='下载 Markdown').click()
    assert info.value.suggested_filename == 'kejian-contribution.md'
    page.get_by_role('button', name='关闭', exact=True).click()
    # Switching from a resource contribution must clear hidden required fields.
    page.get_by_role('button', name='提出课程问题').click()
    assert not page.locator('[name="url"]').evaluate('(e) => e.required')
    page.get_by_role('button', name='关闭', exact=True).click()
    page.reload()
    expect(page.get_by_role('heading', name='虚拟化与容器技术', exact=True)).to_be_visible()
    page.screenshot(path=str(out / 'course.png'), full_page=True)
    for width in [390, 768, 1024]:
        page.set_viewport_size({'width': width, 'height': 844})
        page.goto(base)
        page.wait_for_load_state('networkidle')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'overflow at {width}'
        if width == 390:
            page.screenshot(path=str(out / 'mobile.png'), full_page=True)
            page.locator('#header-contribute').click()
            expect(page.get_by_role('dialog')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.keyboard.press('Escape')
    page.goto(base + '/#/missing')
    expect(page.get_by_role('heading', name='这门课还没收录')).to_be_visible()
    # Verify configured GitHub URL without submitting anything externally.
    def configured_data(route):
        response = route.fetch()
        route.fulfill(response=response, body=re.sub(r"repository:\s*'[^']*'", "repository: 'example/course-library'", response.text(), count=1))
    page.route('**/data/courses.js', configured_data)
    page.goto(base)
    page.locator('#header-contribute').click()
    page.locator('[name="title"]').fill('测试 GitHub 文稿')
    page.locator('[name="semester"]').fill('2026 秋季')
    page.locator('[name="teacher"]').fill('示例教师')
    page.locator('[name="content"]').fill('这是用于验证 GitHub 投稿链接的测试内容。')
    page.get_by_role('button', name='生成投稿文稿').click()
    href = page.locator('#github-submit').get_attribute('href')
    assert href.startswith('https://github.com/example/course-library/issues/new?title=')
    assert '&body=' in href
    assert not errors, errors
    browser.close()
    print('PASS: search, filters, bookmarks persistence, course routes, downloads, feedback, answers, drafts, responsive layouts; no browser errors.')
