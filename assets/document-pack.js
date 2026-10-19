import { createZip, validateDimensions, isPdfHeader, asSize } from './pack-core.mjs';
const $ = id => document.getElementById(id);
const form = $('pack-form');
const status = $('pack-status');
const results = $('pack-results');
const processButton = $('pack-submit');
let downloadUrls = [];
function setStatus(message, error = false) {status.textContent = message;status.dataset.error = String(error);}
function dispose() {for(const url of downloadUrls) URL.revokeObjectURL(url);downloadUrls=[];results.replaceChildren();results.hidden=true;}
function addDownload(name,blob,text) {
  const url = URL.createObjectURL(blob);downloadUrls.push(url);
  const a=document.createElement('a');a.href=url;a.download=name;a.textContent=text||`Download ${name}`;a.className='pack-download';
  results.append(a);
}
const int = id => Number($(id).value);
function selectedFile(id) {return $(id).files?.[0] || null;}
async function imageToOutput(file, {width,height,maxKB,fit,format}) {
  validateDimensions(width,height,maxKB);
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Images must be JPG, PNG or WebP.');
  if(file.size > 25*1024*1024) throw Error('Choose an image smaller than 25 MB.');
  const url = URL.createObjectURL(file);
  let image;
  try {
    image = await new Promise((resolve,reject)=>{const img = new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not read the image.'));img.src=url;});
  } finally {URL.revokeObjectURL(url);}
  if(image.naturalWidth * image.naturalHeight > 40e6) throw Error('Image exceeds the 40-megapixel processing limit.');
  const canvas = document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:format==='image/png'});
  if(!ctx) throw Error('Canvas processing is unavailable in this browser.');
  if(format==='image/jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);}
  const ratio=fit==='cover'?Math.max(width/image.naturalWidth,height/image.naturalHeight):Math.min(width/image.naturalWidth,height/image.naturalHeight);
  const drawW=image.naturalWidth*ratio,drawH=image.naturalHeight*ratio;
  ctx.drawImage(image,(width-drawW)/2,(height-drawH)/2,drawW,drawH);
  const toBlob = quality => new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not encode the image.')),format,quality));
  let blob;
  if(format==='image/jpeg') {
    for(let quality=.94;quality>=.34;quality-=.08){blob=await toBlob(quality);if(blob.size<=maxKB*1024)break;}
  } else blob=await toBlob();
  if(blob.size > maxKB*1024) throw Error(`The ${width}×${height} ${format==='image/png'?'PNG':'JPG'} image is ${asSize(blob.size)}, above ${maxKB} KB. Raise the size limit${format==='image/png'?' or switch the signature to JPG':''}.`);
  return blob;
}
async function checkPdf(file,maxMB){
  if(!file)return null;
  if(!Number.isFinite(maxMB)||maxMB<.1||maxMB>80)throw Error('PDF size limit must be between 0.1 and 80 MB.');
  if(file.size>maxMB*1024*1024)throw Error(`Your PDF is ${asSize(file.size)} and exceeds ${maxMB} MB. Compress it before preparing the pack.`);
  if(file.size>80*1024*1024)throw Error('PDF is too large for browser packaging.');
  if(!isPdfHeader(new Uint8Array(await file.slice(0,5).arrayBuffer()))) throw Error('Selected CV/document does not have a valid PDF header.');
  return file;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();dispose();processButton.disabled=true;setStatus('Preparing and checking documents locally…');
  try {
    const photo=selectedFile('photo'),signature=selectedFile('signature'),pdf=selectedFile('pdf-file');
    if(!photo&&!signature&&!pdf)throw Error('Select at least one photo, signature or PDF.');
    const items=[],summary=[];
    if(photo){const w=int('photo-width'),h=int('photo-height'),limit=int('photo-kb');
      const blob=await imageToOutput(photo,{width:w,height:h,maxKB:limit,fit:'cover',format:'image/jpeg'});
      items.push({name:'application-photo.jpg',blob});summary.push(`Photo: ${w} × ${h} px, ${asSize(blob.size)} (under ${limit} KB)`);}
    if(signature){const w=int('sign-width'),h=int('sign-height'),limit=int('sign-kb');
      const fmt=$('sign-format').value;
      const blob=await imageToOutput(signature,{width:w,height:h,maxKB:limit,fit:'contain',format:fmt});
      items.push({name:`signature.${fmt==='image/png'?'png':'jpg'}`,blob});summary.push(`Signature: ${w} × ${h} px, ${asSize(blob.size)} (under ${limit} KB)`);}
    if(pdf){const f=await checkPdf(pdf,Number($('pdf-max').value));
      items.push({name:'application-document.pdf',blob:f});summary.push(`PDF: ${asSize(f.size)} (under ${$('pdf-max').value} MB)`);}
    const report = `DOCUMENT PACK — FILE CHECKS\n\n${summary.join('\n')}\n\nThese checks verify file formats, output pixel dimensions and file size only. They do not verify document content, photo background rules, identity, or acceptance by any organization. Confirm requirements with the destination.\nFiles were processed in your browser.\n`;
    items.push({name:'requirements-report.txt',blob:new Blob([report],{type:'text/plain'})});
    const zip=await createZip(items);
    const title=document.createElement('h3');title.textContent='Your document pack is ready';results.append(title);
    const details=document.createElement('p');details.textContent=summary.join(' • ');results.append(details);
    addDownload('application-document-pack.zip',zip,'Download complete ZIP pack ↓');
    for (const {name,blob} of items.slice(0,-1))addDownload(name,blob,`Download ${name} ↓`);
    results.hidden=false;
    setStatus('All selected file-size and format checks passed. Confirm external application requirements before submitting.');
  }catch(e){setStatus(e instanceof Error?e.message:'Unable to prepare files.',true);}finally{processButton.disabled=false;}
});
window.addEventListener('pagehide',dispose);
