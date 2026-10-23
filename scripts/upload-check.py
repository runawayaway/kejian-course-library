"""Verify a file larger than the former limit through the published UI."""
import os
from playwright.sync_api import sync_playwright, expect

front=os.getenv('TEST_URL','https://runawayaway.github.io/kejian-course-library')
api=os.getenv('API_TEST_URL','https://kejian-contributions.milkycod4096.chatgpt.site')
payload=b'%PDF-1.4\n'+b' '*(11*1024*1024-9)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.getenv('BROWSER_EXECUTABLE','C:/Program Files/Google/Chrome/Application/chrome.exe'))
    context=browser.new_context()
    page=context.new_page()
    key=''
    try:
        page.goto(front+'/#/course/operating-systems')
        expect(page.locator('.sync-bar [role=status]')).to_have_text('已同步',timeout=30000)
        key=page.evaluate('localStorage.getItem("kejian-device-key")')
        if os.getenv('REQUIRE_PROGRESS')=='1':
            page.evaluate('window.uploadEvents=[];new MutationObserver(()=>window.uploadEvents.push(document.querySelector("#upload-progress").value)).observe(document.querySelector("#upload-progress"),{attributes:true,attributeFilter:["value","hidden"]})')
        page.get_by_role('button',name='上传资料',exact=True).click()
        page.locator('[name=file]').set_input_files({'name':'large-upload-check.pdf','mimeType':'application/pdf','buffer':payload})
        with page.expect_response(lambda r:r.url==api+'/api/entries' and r.request.method=='POST',timeout=180000) as saved:
            page.get_by_role('button',name='上传文件',exact=True).click()
        assert saved.value.status==201,saved.value.text()
        record=saved.value.json()['record']
        assert record['size']==len(payload)
        download=context.request.get(api+record['downloadPath'],timeout=180000)
        assert download.ok and download.body()==payload
        if os.getenv('REQUIRE_PROGRESS')=='1':assert 100 in page.evaluate('window.uploadEvents')
        print('PASS: published UI accepted an 11 MiB file; persisted size and downloaded bytes match.')
    finally:
        if key:
            headers={'X-Device-Key':key}
            listing=context.request.get(api+'/api/contributions',headers=headers).json()
            for row in listing['resources']:
                if row.get('editable') and row.get('filename')=='large-upload-check.pdf':
                    assert context.request.delete(api+'/api/entries/'+row['id'],headers=headers).ok
        browser.close()
