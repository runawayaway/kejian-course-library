"""End-to-end file upload and editing against a real API. Test records are removed."""
import json
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parent.parent
front=os.getenv('TEST_URL','http://localhost:4173').rstrip('/')
api=os.getenv('API_TEST_URL','http://127.0.0.1:8788').rstrip('/')
course_name='浏览器验证课程-'+str(int(time.time()*1000))
with sync_playwright() as p:
    options={'headless':True}
    if os.getenv('BROWSER_EXECUTABLE'):options['executable_path']=os.environ['BROWSER_EXECUTABLE']
    browser=p.chromium.launch(**options)
    context=browser.new_context(viewport={'width':1440,'height':1000})
    context.route('**/assets/runtime-config.js*',lambda route:route.fulfill(status=200,content_type='text/javascript',body='window.API_BASE='+json.dumps(api)+';'))
    page=context.new_page()
    errors=[]
    popups=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('popup',lambda popup:popups.append(popup.url))
    key='';course_id=None
    try:
        page.goto(front+'/')
        expect(page.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000)
        key=page.evaluate('localStorage.getItem("kejian-device-key")')
        expect(page.get_by_role('button',name='继续到 GitHub')).to_have_count(0)
        page.get_by_role('searchbox').fill('Java GUI16')
        expect(page.locator('.course-card')).to_have_count(1)
        page.get_by_role('searchbox').fill('')
        page.get_by_role('button',name='添加课程',exact=False).first.click()
        page.locator('[name=name]').fill(course_name)
        page.get_by_role('button',name='保存课程',exact=True).click()
        expect(page.get_by_role('dialog',name='课程')).not_to_be_visible(timeout=30000)
        expect(page.get_by_role('heading',name=course_name,exact=True)).to_be_visible()
        course_id=page.url.split('/course/')[1].split('?')[0]
        page.get_by_role('button',name='修改课程',exact=True).click()
        expect(page.locator('[name=name]')).to_have_value(course_name)
        page.locator('[name=content]').fill('这门课的简介直接在网页修改。')
        page.get_by_role('button',name='保存修改',exact=True).click()
        expect(page.locator('.detail-description')).to_have_text('这门课的简介直接在网页修改。')
        page.get_by_role('button',name='写经验',exact=True).click()
        page.locator('[name=content]').fill('实验前先整理环境，考核要求请以当学期为准。')
        page.get_by_role('button',name='发布经验',exact=True).click()
        expect(page.locator('.community-record')).to_contain_text('实验前先整理环境',timeout=30000)
        page.locator('[data-edit-record]').click()
        expect(page.locator('[name=content]')).to_have_value('实验前先整理环境，考核要求请以当学期为准。')
        page.locator('[name=content]').fill('修改后的经验：按周完成实验并保留记录。')
        page.get_by_role('button',name='保存修改',exact=True).click()
        expect(page.locator('.community-record')).to_contain_text('修改后的经验',timeout=30000)
        page.get_by_role('button',name='上传资料',exact=True).click()
        pdf=b'%PDF-1.4\n% Browser upload integration check\n%%EOF'
        page.locator('[name=file]').set_input_files({'name':'测试笔记.pdf','mimeType':'application/pdf','buffer':pdf})
        page.locator('[name=content]').fill('浏览器真实上传测试')
        page.get_by_role('button',name='上传文件',exact=True).click()
        expect(page.locator('.resource-body h2')).to_contain_text('测试笔记.pdf',timeout=30000)
        href=page.locator('.resource-body h2 a').get_attribute('href')
        downloaded=page.request.get(href)
        assert downloaded.status==200 and downloaded.body()==pdf
        with page.expect_download() as info:page.locator('.resource-body h2 a').click()
        assert info.value.suggested_filename=='测试笔记.pdf'
        page.locator('[data-edit-resource]').click()
        expect(page.locator('#file-hint')).to_contain_text('测试笔记.pdf')
        page.locator('[name=file]').set_input_files({'name':'更新后的笔记.txt','mimeType':'text/plain','buffer':'更新后的文件内容'.encode()})
        page.get_by_role('button',name='保存修改',exact=True).click()
        expect(page.locator('.resource-body h2')).to_contain_text('更新后的笔记.txt',timeout=30000)
        href=page.locator('.resource-body h2 a').get_attribute('href')
        assert 'v=2' in href and page.request.get(href).body()=='更新后的文件内容'.encode()
        page.reload()
        expect(page.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000)
        page.get_by_role('tab',name='资料 1',exact=True).click()
        expect(page.locator('.resource-body h2')).to_contain_text('更新后的笔记.txt')
        # Other browsers see the saved file and experience but cannot edit them.
        second=browser.new_context(viewport={'width':390,'height':844})
        second.route('**/assets/runtime-config.js*',lambda route:route.fulfill(status=200,content_type='text/javascript',body='window.API_BASE='+json.dumps(api)+';'))
        visitor=second.new_page();visitor.goto(front+'/#/course/'+course_id)
        expect(visitor.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000)
        expect(visitor.get_by_role('heading',name=course_name,exact=True)).to_be_visible()
        expect(visitor.locator('[data-edit-record],[data-edit-course],[data-edit-resource]')).to_have_count(0)
        expect(visitor.locator('.community-record')).to_contain_text('修改后的经验')
        visitor.get_by_role('tab',name='资料 1',exact=True).click()
        expect(visitor.locator('.resource-body h2')).to_contain_text('更新后的笔记.txt')
        assert visitor.evaluate('document.documentElement.scrollWidth<=innerWidth')
        (root/'artifacts').mkdir(exist_ok=True)
        visitor.screenshot(path=str(root/'artifacts/mobile-upload.png'),full_page=True)
        page.screenshot(path=str(root/'artifacts/direct-upload.png'),full_page=True)
        second.close()
        assert not errors,errors
        assert not popups,popups
        print('PASS: real website create/edit, real file upload/download/replacement, reload persistence, cross-device visibility, edit ownership, responsive layout and zero GitHub popups.')
    finally:
        if key:
            headers={'X-Device-Key':key}
            listing=context.request.get(api+'/api/contributions',headers=headers)
            if listing.ok:
                data=listing.json()
                if not course_id:course_id=next((c['id'] for c in data['courses'] if c['name']==course_name and c['editable']),None)
                if course_id:
                    for r in data['resources']+data['records']:
                        if r['courseId']==course_id and r['editable']:
                            assert context.request.delete(api+'/api/entries/'+r['id'],headers=headers).ok
                    assert context.request.delete(api+'/api/entries/'+course_id,headers=headers).ok
        browser.close()
