import os, tempfile, time, subprocess, zipfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parents[1]
img=Path('/tmp/application-photo-test.png');Image.new('RGB',(900,900),(190,125,120)).save(img)
sign=Path('/tmp/application-signature-test.png');Image.new('RGB',(700,190),(255,255,255)).save(sign)
pdf=Path('/tmp/application-cv-test.pdf');pdf.write_bytes(b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
server=subprocess.Popen(['python','-m','http.server','8765','--bind','127.0.0.1'],cwd=base,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(accept_downloads=True)
  errors=[]
  page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content((base/'index.html').read_text())
  assert page.locator('[data-tool-card]').count()==27
  assert page.get_by_text('Document Pack Builder',exact=True).count()>0
  page.set_content((base/'tools/document-pack-builder.html').read_text())
  core=(base/'assets/pack-core.mjs').read_text().replace('export ', '')
  workflow=(base/'assets/document-pack.js').read_text().replace("import { createZip, validateDimensions, isPdfHeader, asSize } from './pack-core.mjs';",'')
  page.add_script_tag(content=core+'\n'+workflow)
  page.locator('#photo').set_input_files(str(img))
  page.locator('#signature').set_input_files(str(sign))
  page.locator('#pdf-file').set_input_files(str(pdf))
  with page.expect_download(timeout=30000) as d:
   page.locator('#pack-submit').click()
   page.get_by_text('Download complete ZIP pack',exact=False).click()
  download=d.value
  assert download.suggested_filename=='application-document-pack.zip'
  with tempfile.TemporaryDirectory() as td:
   path=Path(td)/download.suggested_filename;download.save_as(path)
   with zipfile.ZipFile(path) as z:
    assert set(z.namelist())=={'application-photo.jpg','signature.png','application-document.pdf','requirements-report.txt'}
    assert z.testzip() is None
    from io import BytesIO
    photo=Image.open(BytesIO(z.read('application-photo.jpg')))
    signature=Image.open(BytesIO(z.read('signature.png')))
    assert photo.size==(413,531)
    assert signature.size==(300,100)
    assert len(z.read('application-photo.jpg'))<=200*1024
    assert len(z.read('signature.png'))<=100*1024
    print('Browser ZIP tests passed', z.namelist())
  page.locator('#pdf-max').fill('0.1')
  page.locator('#pdf-file').set_input_files({'name':'invalid.pdf','mimeType':'application/pdf','buffer':b'Not a PDF'})
  page.locator('#pack-submit').click()
  page.wait_for_function("document.querySelector('#pack-status').textContent.includes('valid PDF header')",timeout=10000)
  assert page.locator('#pack-results').is_hidden()
  assert not errors,errors
  browser.close()
finally:
 server.terminate();server.wait(timeout=4)
