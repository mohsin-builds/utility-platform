import {parsePages} from './pdf-pages.mjs';
const mode=document.body.dataset.extMode,$=id=>document.getElementById(id);
const source=$('ext-source'),form=$('ext-form'),status=$('ext-status'),result=$('ext-result'),submit=$('ext-submit');
let bytes=null,views=null,items=[],previewUrls=[],downloadUrls=[],fields=[],redactions=[],draft=null,dragStart=null,activePage=1;
const MAX_SIZE=30*1024*1024,MAX_PAGES=60;
function say(text,error=false){status.textContent=text;status.dataset.error=String(error);}
function clearDownloads(){downloadUrls.forEach(URL.revokeObjectURL);downloadUrls=[];result.replaceChildren();result.hidden=true;}
function reset(){clearDownloads();previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];bytes=null;views=null;items=[];redactions=[];draft=null;dragStart=null;}
function output(blob,name){let u=URL.createObjectURL(blob);downloadUrls.push(u);const a=document.createElement('a');a.className='pdf-download';a.href=u;a.download=name;a.textContent='Download '+name;result.append(a);result.hidden=false;}
function requireLib(){if(!globalThis.PDFLib?.PDFDocument)throw Error('PDF editing library failed to load. Check network access or content blockers.');}
function requireViewer(){if(!globalThis.pdfjsLib?.getDocument)throw Error('PDF rendering library failed to load.');globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';}
async function openBytes(f){if(!f||f.size>MAX_SIZE||!/\.pdf$/i.test(f.name))throw Error('Choose a PDF no larger than 30 MB.');const b=new Uint8Array(await f.arrayBuffer());if(new TextDecoder().decode(b.subarray(0,5))!=='%PDF-')throw Error('File does not have a valid PDF header.');return b;}
async function loadViewer(b){requireViewer();try{return await pdfjsLib.getDocument({data:b.slice(),useSystemFonts:true}).promise;}catch{throw Error('Cannot open PDF. Password-protected or damaged PDFs are unsupported.');}}
async function loadWriter(b){requireLib();try{return await PDFLib.PDFDocument.load(b,{updateMetadata:false});}catch{throw Error('Cannot edit PDF. Password-protected or damaged PDFs are unsupported.');}}
function maxPages(n,limit=MAX_PAGES){if(n<1||n>limit)throw Error('This operation supports 1–'+limit+' pages.');}
function makeCanvas(w,h){w=Math.ceil(w);h=Math.ceil(h);if(w<=0||h<=0||w*h>16000000)throw Error('Page is too large to render in the browser.');const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
async function renderPage(page,scale=1){const v=page.getViewport({scale});const c=makeCanvas(v.width,v.height),ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);await page.render({canvasContext:ctx,viewport:v}).promise;return {canvas:c,viewport:v};}
function blobFrom(canvas,type='image/jpeg',quality=.88){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image encoding failed.')),type,quality));}
function textElement(tag,text){const e=document.createElement(tag);e.textContent=text;return e;}
async function setupPages(){
 reset();const f=source.files[0];if(!f)return;
 submit.disabled=true;
 try{bytes=await openBytes(f);views=await loadViewer(bytes);maxPages(views.numPages,45);
  for(let n=1;n<=views.numPages;n++){say('Preparing page thumbnail '+n+' / '+views.numPages);
   const {canvas}=await renderPage(await views.getPage(n),.27),img=await blobFrom(canvas,'image/jpeg',.72),url=URL.createObjectURL(img);
   previewUrls.push(url);items.push({index:n-1,rotation:0,deleted:false,url});canvas.width=canvas.height=0;
  }paintBoard();say('Page previews loaded. Arrange your pages, then download.');
 }catch(e){say(e.message,true)}
 finally{submit.disabled=false;}
}
function paintBoard(){
 const board=$('page-board');board.replaceChildren();
 items.forEach((item,pos)=>{
  const card=document.createElement('article');card.className='ext-page'+(item.deleted?' removed':'');card.draggable=true;
  const img=document.createElement('img');img.src=item.url;img.alt='PDF page '+(item.index+1);img.style.transform='rotate('+item.rotation+'deg)';
  const label=textElement('strong','Page '+(item.index+1)+(item.deleted?' — removed':''));
  const controls=document.createElement('div');controls.className='ext-actions';
  for(const [name,handler] of [['←',()=>shift(pos,-1)],['→',()=>shift(pos,1)],['↻',()=>{item.rotation=(item.rotation+90)%360;paintBoard()}],[item.deleted?'Restore':'Remove',()=>{item.deleted=!item.deleted;paintBoard()}]]){
   const button=document.createElement('button');button.type='button';button.textContent=name;button.title=name==='↻'?'Rotate clockwise':name;
   button.setAttribute('aria-label',name+' page '+(item.index+1));button.addEventListener('click',handler);controls.append(button);
  }
  card.append(img,label,controls);
  card.addEventListener('dragstart',e=>e.dataTransfer?.setData('text/plain',String(pos)));
  card.addEventListener('dragover',e=>e.preventDefault());
  card.addEventListener('drop',e=>{e.preventDefault();let old=Number(e.dataTransfer?.getData('text/plain'));if(Number.isInteger(old)&&old>=0&&old<items.length){const [m]=items.splice(old,1);items.splice(pos,0,m);paintBoard();}});
  board.append(card);
 });
}
function shift(index,dir){const to=index+dir;if(to<0||to>=items.length)return;[items[index],items[to]]=[items[to],items[index]];paintBoard();}
async function organize(){
 if(!bytes||!items.length)throw Error('Select a PDF and load page previews first.');
 const keep=items.filter(x=>!x.deleted);if(!keep.length)throw Error('At least one page must remain.');
 const sourcePdf=await loadWriter(bytes),dst=await PDFLib.PDFDocument.create();
 const newPages=await dst.copyPages(sourcePdf,keep.map(x=>x.index));
 newPages.forEach((p,i)=>{p.setRotation(PDFLib.degrees((p.getRotation().angle+keep[i].rotation)%360));dst.addPage(p);});
 output(new Blob([await dst.save()],{type:'application/pdf'}),'organized-pages.pdf');
}
function safeImageName(f){return !!f&&['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size<=15*1024*1024;}
async function scan(){
 requireLib();const files=[...$('scanned-files').files];
 if(!files.length||files.length>25||files.some(f=>!safeImageName(f)))throw Error('Choose 1–25 JPG/PNG/WebP images, max 15 MB per image.');
 const doc=await PDFLib.PDFDocument.create(),mode=$('scan-mode').value;
 for(let i=0;i<files.length;i++){
  say('Preparing photo '+(i+1)+' of '+files.length+'…');let image;
  try{image=await createImageBitmap(files[i]);}catch{throw Error('Cannot decode '+files[i].name);}
  try{
   const scale=Math.min(1,2400/Math.max(image.width,image.height)),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));
   const c=makeCanvas(w,h),ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
   ctx.filter=mode==='gray'?'grayscale(1)':mode==='bw'?'grayscale(1) contrast(180%)':'none';
   ctx.drawImage(image,0,0,w,h);ctx.filter='none';
   const jpeg=await blobFrom(c,'image/jpeg',.86),embedded=await doc.embedJpg(await jpeg.arrayBuffer());c.width=c.height=0;
   const page=doc.addPage([595.28,841.89]),factor=Math.min(535/embedded.width,781/embedded.height);
   const pw=embedded.width*factor,ph=embedded.height*factor;page.drawImage(embedded,{x:(595.28-pw)/2,y:(841.89-ph)/2,width:pw,height:ph});
  }finally{image.close()}
 }
 output(new Blob([await doc.save()],{type:'application/pdf'}),'scanned-documents.pdf');
}
function createFieldRow(i){
 const row=document.createElement('div');row.className='ext-form-row';row.dataset.index=String(i);
 for(const [key,label,value] of [['name','Field name','field-'+(i+1)],['kind','Type','text'],['page','Page','1'],['x','Left (pt)','50'],['y','Bottom (pt)','650'],['width','Width (pt)','220'],['height','Height (pt)','28'],['options','Dropdown options (comma separated)','Yes,No']]){
  const wrapper=document.createElement('label');wrapper.textContent=label;
  let input;
  if(key==='kind'){input=document.createElement('select');for(const [v,t] of [['text','Text field'],['checkbox','Checkbox'],['dropdown','Dropdown']]){let opt=document.createElement('option');opt.value=v;opt.textContent=t;input.append(opt);}}
  else{input=document.createElement('input');input.type=['page','x','y','width','height'].includes(key)?'number':'text';input.value=value;if(input.type==='number'){input.min=key==='page'?'1':'0';input.step='1';}}
  input.dataset.key=key;wrapper.append(input);row.append(wrapper);
 }
 const remove=document.createElement('button');remove.type='button';remove.textContent='Remove field';remove.addEventListener('click',()=>row.remove());row.append(remove);return row;
}
function addField(){const board=$('form-fields');if(board.children.length>=30){say('Maximum 30 fields.',true);return;}board.append(createFieldRow(fields.length++));}
$('add-form-field')?.addEventListener('click',addField);
if(mode==='forms')addField();
async function forms(){
 requireLib();const data=await openBytes(source.files[0]),doc=await loadWriter(data),pages=doc.getPages(),pdfForm=doc.getForm();
 const rows=[...$('form-fields').children];if(!rows.length)throw Error('Add at least one field.');
 for(const row of rows){
  const obj=Object.fromEntries([...row.querySelectorAll('[data-key]')].map(el=>[el.dataset.key,el.value]));
  const name=obj.name.trim(),pageNum=Number(obj.page),x=Number(obj.x),y=Number(obj.y),width=Number(obj.width),height=Number(obj.height);
  if(!name||name.length>64||pdfForm.getFields().some(f=>f.getName()===name))throw Error('Field names must be unique and 1–64 characters.');
  if(!Number.isInteger(pageNum)||pageNum<1||pageNum>pages.length)throw Error('Invalid page number for '+name);
  const page=pages[pageNum-1],size=page.getSize();
  if(![x,y,width,height].every(Number.isFinite)||x<0||y<0||width<15||height<12||x+width>size.width||y+height>size.height)throw Error('Field '+name+' does not fit inside page '+pageNum);
  const common={x,y,width,height,borderWidth:1,borderColor:PDFLib.rgb(.55,.61,.70),backgroundColor:PDFLib.rgb(.98,.99,1)};
  if(obj.kind==='text'){const f=pdfForm.createTextField(name);f.addToPage(page,common);}
  else if(obj.kind==='checkbox'){const f=pdfForm.createCheckBox(name);f.addToPage(page,{...common,width:Math.min(width,height),height:Math.min(width,height)});}
  else if(obj.kind==='dropdown'){const options=obj.options.split(',').map(s=>s.trim()).filter(Boolean).slice(0,20);
   if(!options.length)throw Error('Dropdown '+name+' needs options.');const f=pdfForm.createDropdown(name);f.addOptions(options);f.addToPage(page,common);
  }
 }
 output(new Blob([await doc.save()],{type:'application/pdf'}),'fillable-form.pdf');
}
function coordinates(event){
 const canvas=$('page-canvas'),rect=canvas.getBoundingClientRect();
 return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
}
async function setupRedaction(){
 reset();const f=source.files[0];if(!f)return;submit.disabled=true;
 try{bytes=await openBytes(f);views=await loadViewer(bytes);maxPages(views.numPages,12);
  const select=$('page-select');select.replaceChildren();
  for(let i=1;i<=views.numPages;i++){const o=document.createElement('option');o.value=String(i);o.textContent='Page '+i;select.append(o);}
  activePage=1;await showPreview();say('Drag a rectangle to select content that must be removed.');
 }catch(e){say(e.message,true)}
 finally{submit.disabled=false;}
}
async function showPreview(){
 if(!views)return;
 const {canvas}=await renderPage(await views.getPage(activePage),Math.min(.85,700/(await views.getPage(activePage)).getViewport({scale:1}).width));
 const board=$('page-canvas');board.width=canvas.width;board.height=canvas.height;
 const ctx=board.getContext('2d');ctx.drawImage(canvas,0,0);canvas.width=canvas.height=0;
 for(const mask of redactions.filter(x=>x.page===activePage)){
  ctx.fillStyle='#000';ctx.fillRect(mask.x*board.width,mask.y*board.height,mask.w*board.width,mask.h*board.height);
 }
 if(draft){ctx.lineWidth=2;ctx.strokeStyle='#e95f46';ctx.strokeRect(draft.x*board.width,draft.y*board.height,draft.w*board.width,draft.h*board.height);}
 $('redaction-count').textContent=redactions.length+' redaction rectangle(s) stored. Drag a region, then select “Add selected rectangle”.';
}
const canvas=$('page-canvas');
canvas?.addEventListener('pointerdown',e=>{if(!views)return;dragStart=coordinates(e);draft=null;canvas.setPointerCapture(e.pointerId);});
canvas?.addEventListener('pointermove',e=>{
 if(!dragStart)return;const p=coordinates(e);draft={x:Math.min(p.x,dragStart.x),y:Math.min(p.y,dragStart.y),w:Math.abs(p.x-dragStart.x),h:Math.abs(p.y-dragStart.y)};
 showPreview().catch(err=>say(err.message,true));
});
canvas?.addEventListener('pointerup',e=>{
 if(!dragStart)return;const p=coordinates(e);draft={x:Math.min(p.x,dragStart.x),y:Math.min(p.y,dragStart.y),w:Math.abs(p.x-dragStart.x),h:Math.abs(p.y-dragStart.y)};dragStart=null;
 showPreview().catch(err=>say(err.message,true));
});
canvas?.addEventListener('pointercancel',()=>{dragStart=null;draft=null;});
$('page-select')?.addEventListener('change',async e=>{activePage=Number(e.target.value);draft=null;await showPreview();});
$('add-redaction')?.addEventListener('click',()=>{
 if(!draft||draft.w<.006||draft.h<.006){say('Drag a visible rectangle first.',true);return;}
 redactions.push({...draft,page:activePage});draft=null;showPreview().catch(e=>say(e.message,true));
});
$('clear-redactions')?.addEventListener('click',()=>{redactions=[];draft=null;showPreview().catch(e=>say(e.message,true));});
async function redact(){
 requireLib();if(!bytes||!views)throw Error('Choose a PDF and load its preview first.');
 if(!redactions.length)throw Error('Select and add at least one redaction rectangle.');
 const out=await PDFLib.PDFDocument.create();
 for(let n=1;n<=views.numPages;n++){
  say('Rasterizing and removing hidden content from page '+n+' of '+views.numPages+'…');
  const page=await views.getPage(n),v=page.getViewport({scale:1});
  const scale=Math.min(1.8,Math.sqrt(12000000/(v.width*v.height)));
  const {canvas:c}=await renderPage(page,scale),ctx=c.getContext('2d');
  ctx.fillStyle='#000';
  for(const mask of redactions.filter(x=>x.page===n))ctx.fillRect(Math.floor(mask.x*c.width),Math.floor(mask.y*c.height),Math.ceil(mask.w*c.width),Math.ceil(mask.h*c.height));
  const jpeg=await blobFrom(c,'image/jpeg',.92),image=await out.embedJpg(await jpeg.arrayBuffer());
  const newPage=out.addPage([v.width,v.height]);newPage.drawImage(image,{x:0,y:0,width:v.width,height:v.height});c.width=c.height=0;
 }
 output(new Blob([await out.save()],{type:'application/pdf'}),'redacted-flattened.pdf');
}
if(mode==='organize')source.addEventListener('change',setupPages);
if(mode==='redact')source.addEventListener('change',setupRedaction);
form?.addEventListener('submit',async e=>{
 e.preventDefault();clearDownloads();submit.disabled=true;say('Processing your document locally…');
 try{
  if(mode==='organize')await organize();else if(mode==='scan')await scan();else if(mode==='forms')await forms();else if(mode==='redact')await redact();else throw Error('Unknown operation.');
  say('Done. Download and carefully inspect the result.');
 }catch(err){say(err.message||'Unable to process this document.',true)}
 finally{submit.disabled=false;}
});
window.addEventListener('pagehide',reset);
