import {createZip} from './pack-core.mjs';
const $=id=>document.getElementById(id),mode=document.body.dataset.operation,form=$('task-form'),input=$('file'),result=$('download-area'),message=$('task-message'),submit=$('submit-task');
let links=[];
const MAX_BYTES=30*1024*1024,MAX_PAGES=80;
function notice(text,error=false){message.textContent=text;message.dataset.error=String(error);}
function reset(){for(const url of links)URL.revokeObjectURL(url);links=[];result.replaceChildren();result.hidden=true;}
function download(blob,name){
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');
 links.push(url);anchor.href=url;anchor.download=name;anchor.className='pdf-download';anchor.textContent='Download '+name;
 result.append(anchor);result.hidden=false;
}
input.addEventListener('change',()=>{reset();const f=input.files[0];notice(f?f.name+' · '+(f.size/1048576).toFixed(2)+' MB selected':'Choose a PDF to begin.');});
async function getBytes(file){
 if(!file||!/\.pdf$/i.test(file.name))throw Error('Choose a PDF document (.pdf).');
 if(file.size>MAX_BYTES)throw Error('Maximum PDF file size is 30 MB.');
 const data=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw Error('The selected document does not have a valid PDF header.');
 return data;
}
async function pdfLibDoc(file){if(!globalThis.PDFLib?.PDFDocument)throw Error('PDF library unavailable. Check your connection.');try{return await PDFLib.PDFDocument.load(await getBytes(file),{updateMetadata:false});}catch{throw Error('This PDF cannot be opened. Password-protected or damaged files are unsupported.');}}
async function pdfJsDoc(file){
 if(!globalThis.pdfjsLib?.getDocument)throw Error('PDF rendering engine could not load. Check your connection or blockers.');
 const bytes=await getBytes(file);
 pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
 try{return await pdfjsLib.getDocument({data:bytes,useSystemFonts:true}).promise;}
 catch{throw Error('Unable to render this PDF. Password-protected or damaged files are unsupported.');}
}
function pagesLimit(n){if(!n||n>MAX_PAGES)throw Error('This operation currently supports 1–'+MAX_PAGES+' pages.');}
const blobDoc=async doc=>new Blob([await doc.save()],{type:'application/pdf'});
const number=(id,min,max)=>{const n=Number($(id).value);if(!Number.isFinite(n)||n<min||n>max)throw Error(id+' must be between '+min+' and '+max+'.');return n;};
async function raster(page,scale,quality,mime){
 const v=page.getViewport({scale}),canvas=document.createElement('canvas');
 if(v.width*v.height>18_000_000)throw Error('Page is too large at this resolution. Use a lower DPI.');
 canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas not available.');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 await page.render({canvasContext:ctx,viewport:v}).promise;
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image encoding failed.')),mime,quality));
 canvas.width=0;canvas.height=0;
 return {blob,base:page.getViewport({scale:1})};
}
async function imageExport(file){
 const doc=await pdfJsDoc(file);pagesLimit(doc.numPages);
 const mime=$('image-type').value,scale=number('dpi',72,180)/72,extension=mime==='image/png'?'png':'jpg';
 const entries=[];
 for(let i=1;i<=doc.numPages;i++){
  notice('Rendering page '+i+' of '+doc.numPages+'…');
  const {blob}=await raster(await doc.getPage(i),scale,.88,mime);
  entries.push({name:'page-'+String(i).padStart(3,'0')+'.'+extension,blob});
 }
 if(entries.length===1)download(entries[0].blob,entries[0].name);
 else download(await createZip(entries),'pdf-pages-'+extension+'.zip');
}
async function compress(file){
 const source=await pdfJsDoc(file);pagesLimit(source.numPages);
 const density=number('dpi',72,160)/72,quality=number('quality',35,90)/100;
 const doc=await PDFLib.PDFDocument.create();
 for(let i=1;i<=source.numPages;i++){
  notice('Compressing page '+i+' of '+source.numPages+'…');
  const {blob,base}=await raster(await source.getPage(i),density,quality,'image/jpeg');
  const jpg=await doc.embedJpg(await blob.arrayBuffer());
  const p=doc.addPage([base.width,base.height]);p.drawImage(jpg,{x:0,y:0,width:base.width,height:base.height});
 }
 const blob=await blobDoc(doc);const diff=((1-blob.size/file.size)*100).toFixed(1);
 const p=document.createElement('p');
 p.textContent='Original '+(file.size/1048576).toFixed(2)+' MB · Result '+(blob.size/1048576).toFixed(2)+' MB · '+(blob.size<file.size?diff+'% smaller.':'Result is not smaller. Try lower DPI or JPEG quality.');
 result.append(p);download(blob,'raster-compressed.pdf');
}
async function crop(file){
 const doc=await pdfLibDoc(file),pages=doc.getPages();pagesLimit(pages.length);
 const top=number('top',0,400),bottom=number('bottom',0,400),left=number('left',0,400),right=number('right',0,400);
 for(const p of pages){
  const {width,height}=p.getSize();
  if(width-left-right<24||height-top-bottom<24)throw Error('Crop margins leave too little visible page area.');
  p.setCropBox(left,bottom,width-left-right,height-top-bottom);
 }
 download(await blobDoc(doc),'cropped.pdf');
}
async function annotate(file){
 const doc=await pdfLibDoc(file),pages=doc.getPages();pagesLimit(pages.length);
 const text=$('overlay-text').value.trim(),size=number('font-size',8,44);
 if(!text||text.length>180||/[^\x20-\x7e]/.test(text))throw Error('Enter 1–180 printable English characters.');
 const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
 for(const page of pages){const {width,height}=page.getSize();
  page.drawText(text,{x:36,y:Math.max(20,height-55),size,font,color:PDFLib.rgb(.16,.22,.32),maxWidth:Math.max(50,width-72)});
 }
 download(await blobDoc(doc),'annotated.pdf');
}
async function sign(file){
 const doc=await pdfLibDoc(file),pages=doc.getPages();pagesLimit(pages.length);
 const sig=$('signature').files?.[0];
 if(!sig||sig.size>8*1024*1024||!['image/png','image/jpeg'].includes(sig.type))throw Error('Choose a JPG or PNG signature under 8 MB.');
 const bytes=await sig.arrayBuffer(),image=sig.type==='image/png'?await doc.embedPng(bytes):await doc.embedJpg(bytes);
 const target=$('sign-pages').value==='all'?pages:[pages.at(-1)];
 for(const page of target){
  const {width}=page.getSize(),maxW=Math.min(180,width*.43),maxH=68,ratio=Math.min(maxW/image.width,maxH/image.height);
  const w=image.width*ratio,h=image.height*ratio;
  page.drawImage(image,{x:Math.max(12,width-w-42),y:50,width:w,height:h});
 }
 download(await blobDoc(doc),'signed-image.pdf');
}
async function extractText(file){
 const doc=await pdfJsDoc(file);pagesLimit(doc.numPages);const resultLines=[];
 for(let i=1;i<=doc.numPages;i++){
  notice('Extracting selectable text from page '+i+' of '+doc.numPages+'…');
  const page=await doc.getPage(i),content=await page.getTextContent();
  const text=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('').trim();
  resultLines.push('--- PAGE '+i+' ---\n'+text);
 }
 const text=resultLines.join('\n\n');
 if(!text.replace(/--- PAGE \d+ ---/g,'').trim())throw Error('No selectable text found. This document likely needs OCR, which this tool does not provide.');
 download(new Blob([text],{type:'text/plain;charset=utf-8'}),'pdf-text.txt');
}
form.addEventListener('submit',async e=>{
 e.preventDefault();reset();submit.disabled=true;notice('Processing locally in this browser…');
 try{
  const f=input.files[0];
  if(!f)throw Error('Choose a PDF first.');
  if(mode==='image')await imageExport(f);
  else if(mode==='compress')await compress(f);
  else if(mode==='crop')await crop(f);
  else if(mode==='text')await annotate(f);
  else if(mode==='sign')await sign(f);
  else if(mode==='extracttext')await extractText(f);
  else throw Error('Unknown tool operation.');
  notice('Completed. Download and inspect your file below.');
 }catch(error){notice(error?.message||'Processing failed.',true);}
 finally{submit.disabled=false;}
});
window.addEventListener('pagehide',reset);