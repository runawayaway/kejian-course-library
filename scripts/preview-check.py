"""Exercise preview using real public files and temporary persisted uploads."""
import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

front=os.getenv('TEST_URL','http://localhost:4173').rstrip('/')
api='https://kejian-contributions.milkycod4096.chatgpt.site'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    context=browser.new_context(viewport={'width':1360,'height':960})
    page=context.new_page();created=[];downloads=[];errors=[];key=''
    page.on('download',lambda d:downloads.append(d.suggested_filename))
    page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        page.goto(front+'/#/course/data-visualization?tab=resources')
        expect(page.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000)
        key=page.evaluate('localStorage.getItem("kejian-device-key")')
        headers={'X-Device-Key':key}
        pdf=page.get_by_role('link',name='实验4-使用Python可视化库绘图',exact=True)
        pdf.click()
        expect(page.locator('#preview-content iframe')).to_have_attribute('src',__import__('re').compile('^blob:'),timeout=45000)
        blob=page.locator('#preview-content iframe').get_attribute('src')
        assert page.evaluate('async url=>{const r=await fetch(url);return r.headers.get("content-type")}',blob)=='application/pdf'
        assert not downloads
        page.get_by_role('button',name='关闭预览',exact=True).click()
        expect(page.locator('#preview-content iframe')).to_have_count(0)
        text='<script>window.previewUnsafe=true</script>\n课程笔记：预览不会执行文件中的代码。'
        filename='preview-check-'+str(int(time.time()))+'.txt'
        response=context.request.post(api+'/api/entries',headers=headers,multipart={'metadata':json.dumps({'kind':'resource','courseId':'operating-systems'}),'file':{'name':filename,'mimeType':'text/plain','buffer':text.encode()}})
        assert response.status==201,response.text()
        created.append(response.json()['id'])
        page.goto(front+'/#/course/operating-systems?tab=resources')
        page.reload()
        page.get_by_role('link',name=filename,exact=True).click(timeout=30000)
        expect(page.locator('#preview-content pre')).to_have_text(text,timeout=30000)
        assert page.evaluate('window.previewUnsafe') is None
        with page.expect_download() as downloaded:page.locator('#preview-download').click()
        assert downloaded.value.suggested_filename==filename
        page.set_viewport_size({'width':390,'height':844})
        assert page.locator('#preview-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
        Path('artifacts').mkdir(exist_ok=True)
        page.screenshot(path='artifacts/text-preview-mobile.png')
        page.keyboard.press('Escape')
        page.goto(front+'/#/course/java?tab=resources')
        page.get_by_role('link',name='GUI-实验报告',exact=True).click()
        expect(page.locator('#preview-content iframe')).to_have_attribute('src',__import__('re').compile('^https://view.officeapps.live.com/'))
        src=page.locator('#preview-content iframe').get_attribute('src')
        assert 'raw.githubusercontent.com' in __import__('urllib.parse',fromlist=['unquote']).unquote(src)
        page.get_by_role('button',name='关闭预览',exact=True).click()
        assert not errors,errors
        print('PASS: actual source PDF previews without download; uploaded text renders safely; explicit download, mobile layout, Escape cleanup and Office preview URL work.')
    finally:
        for record in created:
            assert context.request.delete(api+'/api/entries/'+record,headers={'X-Device-Key':key}).ok
        browser.close()
