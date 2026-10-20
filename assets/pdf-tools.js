import {parsePages,parseGroups,validateReorder} from './pdf-pages.mjs';
import {createZip} from './pack-core.mjs';
const $=id=>document.getElementById(id),kind=document.body.dataset.operation;
const input=$('files'),form=$('pdf-form'),message=$('status'),results=$('results'),order=$('file-order'),go=$('process');
let files=[],urls=[];
const say=(s,error=false)=>{message.textContent=s;message.dataset.error=String(error)};
function clear(){for(const url of urls)URL.revokeObjectURL(url);urls=[];results.replaceChildren();results.hidden=true}
function reorderFiles(){
 order.replaceChildren();order.hidden=kind!=='merge'||files.length<2;
 if(order.hidden)return;
 files.forEach((f,i)=>{const li=document.createElement('li'),name=document.createElement('span');
 name.textContent=(i+1)+'. '+f.name;li.append(name);
 for(const [symbol,delta] of [['↑',-1],['↓',1]]){const b=document.createElement('button');b.type='button';b.textContent=symbol;b.disabled=i+delta<0||i+delta>=files.length;
 b.setAttribute('aria-label','Move '+f.name+(delta===1?' down':' up'));
 b.onclick=()=>{[files[i],files[i+delta]]=[files[i+delta],files[i]];reorderFiles()};li.append(b)}order.append(li)});
}
input.addEventListener('change',()=>{files=[...input.files];clear();reorderFiles();say(files.length+' PDF file(s) selected.')});
async function openPdf(f){
 if(!f||!f.name.toLowerCase().endsWith('.pdf'))throw Error('Choose a PDF file.');
 if(f.size>30*1024*1024)throw Error('30 MB maximum per PDF.');
 const b=await f.arrayBuffer();
 if(new TextDecoder().decode(b.slice(0,5))!=='%PDF-')throw Error('Invalid PDF header: '+f.name);
 try{return await PDFLib.PDFDocument.load(b,{updateMetadata:false})}
 catch{throw Error('Cannot read '+f.name+'. Password-protected or corrupt PDFs are unsupported.')}
}
function count(doc){const n=doc.getPageCount();if(n<1||n>500)throw Error('1–500 PDF pages supported.');return n}
async function copy(doc,pages){
 const dst=await PDFLib.PDFDocument.create(),arr=await dst.copyPages(doc,pages);
 arr.forEach(p=>dst.addPage(p));return dst
}
async function asBlob(doc){return new Blob([await doc.save()],{type:'application/pdf'})}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');urls.push(url);a.href=url;a.download=name;a.textContent='Download '+name;a.className='pdf-download';results.append(a);results.hidden=false}
form.addEventListener('submit',async e=>{
 e.preventDefault();clear();go.disabled=true;say('Processing PDF locally…');
 try{
  if(!globalThis.PDFLib?.PDFDocument)throw Error('PDF library failed to load. Check internet access/content blockers. No file has been uploaded.');
  if(files.length<(kind==='merge'?2:1)||kind!=='merge'&&files.length!==1)throw Error(kind==='merge'?'Choose at least two PDFs.':'Choose one PDF.');
  if(files.length>20||files.reduce((s,f)=>s+f.size,0)>75*1024*1024)throw Error('Maximum 20 files / 75 MB total.');
  if(kind==='merge'){
   const dst=await PDFLib.PDFDocument.create();let nTotal=0;
   for(const f of files){const src=await openPdf(f),n=count(src);nTotal+=n;if(nTotal>500)throw Error('Maximum 500 pages total.');
    (await dst.copyPages(src,Array.from({length:n},(_,i)=>i))).forEach(p=>dst.addPage(p))}
   download(await asBlob(dst),'merged.pdf');
  }else{
   const doc=await openPdf(files[0]),n=count(doc),spec=$('page-spec')?.value||'';
   if(kind==='split'){
    const groups=parseGroups(spec,n),entries=[];
    for(let i=0;i<groups.length;i++)entries.push({name:'part-'+(i+1)+'.pdf',blob:await asBlob(await copy(doc,groups[i]))});
    if(entries.length===1)download(entries[0].blob,entries[0].name);
    else download(await createZip(entries),'split-pdf.zip');
   }else if(kind==='extract')download(await asBlob(await copy(doc,parsePages(spec,n))),'extracted.pdf');
   else if(kind==='delete'){
    const removed=new Set(parsePages(spec,n)),keep=Array.from({length:n},(_,i)=>i).filter(i=>!removed.has(i));
    if(!keep.length)throw Error('Cannot delete all pages.');
    download(await asBlob(await copy(doc,keep)),'pages-removed.pdf');
   }else if(kind==='reorder')download(await asBlob(await copy(doc,validateReorder(parsePages(spec,n),n))),'reordered.pdf');
   else if(kind==='rotate'){
    const angle=Number($('rotation').value);
    if(![90,180,270].includes(angle))throw Error('Invalid rotation.');
    for(const i of parsePages(spec,n,{allIfBlank:true})){const p=doc.getPage(i);p.setRotation(PDFLib.degrees((p.getRotation().angle+angle)%360))}
    download(await asBlob(doc),'rotated.pdf');
   }else if(kind==='watermark'){
    const txt=$('watermark').value.trim();
    if(!txt||txt.length>80||/[^\x20-\x7e]/.test(txt))throw Error('Enter 1–80 printable English characters.');
    const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    for(const page of doc.getPages()){const {width,height}=page.getSize(),size=Math.max(12,Math.min(28,width/20));
      page.drawText(txt,{x:Math.max(10,(width-font.widthOfTextAtSize(txt,size))/2),y:height/2,font,size,color:PDFLib.rgb(.42,.45,.5),opacity:.25})}
    download(await asBlob(doc),'watermarked.pdf');
   }else if(kind==='numbers'){
    const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    doc.getPages().forEach((page,i)=>{const str=(i+1)+' / '+n,size=11,{width}=page.getSize();
      page.drawText(str,{x:Math.max(12,(width-font.widthOfTextAtSize(str,size))/2),y:20,size,font,color:PDFLib.rgb(.3,.34,.4)})});
    download(await asBlob(doc),'numbered.pdf');
   }
  }
  say('Done. Download your processed PDF below.');
 }catch(err){say(err?.message||'Unable to process this PDF.',true)}
 finally{go.disabled=false}
});
window.addEventListener('pagehide',clear);