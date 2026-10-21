"""Check real public data, legacy links, unavailable API and transient recovery."""
import os
from playwright.sync_api import sync_playwright,expect
front=os.getenv('TEST_URL','http://localhost:4173').rstrip('/')
canonical='60c8ae59-3fe9-4142-b58c-277c39fd241e'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    for mode in ['fresh','offline','retry']:
        context=browser.new_context()
        attempts=[0]
        if mode in ['offline','retry']:
            def intercept(route):
                attempts[0]+=1
                if mode=='offline' or attempts[0]==1:route.abort()
                else:route.continue_()
            context.route('**/api/contributions',intercept)
        page=context.new_page()
        page.goto(front+'/#/course/student-2')
        expect(page.get_by_role('heading',name='高等数学',exact=True)).to_be_visible(timeout=30000)
        assert page.url.endswith('#/course/'+canonical),page.url
        if mode=='offline':
            expect(page.locator('.sync-bar [role=status]')).to_have_text('未连接到最新内容，当前显示备份',timeout=30000)
        else:
            expect(page.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000)
        page.get_by_role('link',name='全部课程',exact=True).first.click()
        page.get_by_role('searchbox').fill('高等数学')
        expect(page.locator('.course-card')).to_have_count(1)
        assert page.locator('[data-edit-course]').count()==0
        if mode=='retry':assert attempts[0]>=2
        print('PASS:',mode,'legacy link, canonical URL, public course and search')
        context.close()
    browser.close()
