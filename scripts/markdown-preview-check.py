"""Browser regression: actual guide rendering plus hostile Markdown and plain-text fallback."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

front=os.getenv('TEST_URL','http://localhost:4173').rstrip('/')
sample='''# 阅读示例

这段包含 **重点**、*强调* 与 `inline()`。

## 学习步骤
1. 阅读资料
2. 完成实验

> 请核对教师和学期。

| 名称 | 内容 |
| --- | --- |
| 实验 | 进程调度 |

```js
const text = '<script>window.previewUnsafe=true</script>';
```

[相对链接](next.md)
![图片](../image.png)
[危险链接](javascript:window.previewUnsafe=true)
<script>window.previewUnsafe=true</script>
<img src="x" onerror="window.previewUnsafe=true">
<svg onload="window.previewUnsafe=true"></svg>
<iframe srcdoc="<script>window.previewUnsafe=true</script>"></iframe>
<form><input name="location"><button>submit</button></form>
<a href="data:text/html,bad">危险数据链接</a>
'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
 ctx=b.new_context(viewport={'width':1360,'height':960})
 page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(front+'/#/course/operating-systems?tab=guides')
 page.get_by_role('button',name='阅读完整指引',exact=True).click()
 article=page.locator('.markdown-preview');expect(article.locator('h1')).to_contain_text('操作系统')
 expect(article.locator('h2')).not_to_have_count(0)
 expect(page.locator('#preview-note')).to_have_text('Markdown 阅读预览')
 page.keyboard.press('Escape');expect(article).to_have_count(0)
 ctx.route('**/markdown-test/docs/test.markdown',lambda route:route.fulfill(body=sample,content_type='text/markdown'))
 page.evaluate("url=>CoursePreview.open({title:'Markdown 阅读示例',format:'MARKDOWN',url})",front+'/markdown-test/docs/test.markdown')
 expect(article.locator('h1')).to_have_text('阅读示例');expect(article.locator('strong')).to_have_text('重点')
 expect(article.locator('table tbody td')).to_have_count(2);expect(article.locator('ol li')).to_have_count(2)
 expect(article.locator('pre code')).to_contain_text('<script>window.previewUnsafe=true</script>')
 expect(article.get_by_role('link',name='相对链接')).to_have_attribute('href',front+'/markdown-test/docs/next.md')
 expect(article.locator('img[alt="图片"]')).to_have_attribute('src',front+'/markdown-test/image.png')
 assert article.locator('script,iframe,svg,form,input,button,[onerror],[onload],[style],[id]').count()==0
 assert not article.locator('a[href^="javascript:"],a[href^="data:"]').count()
 assert page.evaluate('window.previewUnsafe') is None
 expect(page.locator('#preview-download')).to_have_attribute('href',front+'/markdown-test/docs/test.markdown')
 page.screenshot(path='artifacts/markdown-preview-desktop.png')
 page.set_viewport_size({'width':390,'height':844});page.evaluate("document.documentElement.dataset.theme='dark'")
 assert page.locator('#preview-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth')
 assert article.evaluate('e=>e.scrollWidth<=e.clientWidth')
 page.screenshot(path='artifacts/markdown-preview-mobile.png');page.keyboard.press('Escape')
 expect(article).to_have_count(0)
 ctx.route('**/plain-test.txt',lambda route:route.fulfill(body=sample,content_type='text/plain'))
 page.evaluate("url=>CoursePreview.open({title:'纯文本',format:'TXT',url})",front+'/plain-test.txt')
 expect(page.locator('#preview-content>pre')).to_have_text(sample);expect(page.locator('.markdown-preview')).to_have_count(0)
 assert not errors,errors
 b.close()
print('PASS: real guide, headings/lists/table/code, relative URLs, XSS filtering, original download URL, dark mobile layout, close cleanup and plain-text isolation.')
