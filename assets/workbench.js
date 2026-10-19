import {loadBitmap,formatBytes,safeFileName,convert,compressToBytes,resizeQuality,resizeSignature} from './toolkit.js';
import './site.js';
const $=(s)=>document.querySelector(s);
const upload=$('#file-input'),drop=$('#dropzone'),summary=$('#file-summary'),thumb=$('#thumb'),details=$('#file-details'),status=$('#status'),btn=$('#process'),result=$('#result'),download=$('#download'),resultDetails=$('#result-details');
const task=document.body.dataset.task;let selected=null,thumbnailUrl=null,downloadUrl=null,lastProcessed=null;
function notify(message,type=''){status.textContent=message;status.className=`status ${type}`;}
function resetResult(){lastProcessed=null;result.classList.remove('show');download.removeAttribute('href');if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}const preview=$('#result-preview');if(preview)preview.removeAttribute('src');}
function refreshPreview(){if(thumbnailUrl)URL.revokeObjectURL(thumbnailUrl);thumbnailUrl=URL.createObjectURL(selected);thumb.src=thumbnailUrl;}
async function selectFile(file){resetResult();selected=null;btn.disabled=true;summary.classList.remove('show');
 if(!file){notify('No file selected.');return;}
 try{const img=await loadBitmap(file);details.textContent=`${formatBytes(file.size)} · ${img.width} × ${img.height} · ${file.type.split('/')[1].toUpperCase()}`;img.close();
 selected=file;refreshPreview();$('#file-name').textContent=file.name;summary.classList.add('show');btn.disabled=false;notify('Your file stays in this browser. Ready to process.');}
 catch(e){notify(e.message,'error');upload.value='';}}
upload.addEventListener('change',()=>selectFile(upload.files?.[0]));
drop.addEventListener('click',(e)=>{if(e.target!==upload)upload.click()});
drop.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();upload.click();}});
for(const event of ['dragenter','dragover'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('dragover')});
for(const event of ['dragleave','drop'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragover')});
drop.addEventListener('drop',e=>selectFile([...e.dataTransfer.files][0]));
function num(selector,min,max,label){const n=Number($(selector).value);if(!Number.isFinite(n)||n<min||n>max||!Number.isInteger(n))throw new Error(`${label} must be a whole number from ${min} to ${max}.`);return n;}
if(task==='resize'){
 const purpose=$('#purpose'),sig=$('#signature-options'),mime=$('#mime'),quality=$('#quality'),qualityField=$('#quality-field'),fitField=$('#fit-field'),exportField=$('#signature-export-field');
 function refreshMode(){
  const signature=purpose.value==='signature';sig.hidden=!signature;fitField.hidden=signature;exportField.hidden=!signature;
  for(const id of ['width','height'])$('#'+id).disabled=signature&&document.querySelector('input[name="signature-export"]:checked')?.value==='master';
  if(signature){mime.value='image/png';mime.disabled=document.querySelector('input[name="signature-export"]:checked')?.value==='master';qualityField.hidden=true;btn.dataset.label='Refine signature';}
  else {mime.value='image/jpeg';mime.disabled=false;qualityField.hidden=false;btn.dataset.label='Resize image';}
  btn.textContent=btn.dataset.label;
  resetResult();notify(signature?'Signature mode: best with dark ink on light paper. PNG selected to avoid JPG artifacts.':'Photo mode: preserves aspect ratio with improved downscaling.');
 }
 purpose.addEventListener('change',refreshMode);
 document.querySelectorAll('input[name="signature-export"]').forEach(el=>el.addEventListener('change',()=>{
   const master=document.querySelector('input[name="signature-export"]:checked')?.value==='master';
   for(const id of ['width','height'])$('#'+id).disabled=master;
   if(master){mime.value='image/png';mime.disabled=true;qualityField.hidden=true;}
   else{mime.disabled=false;qualityField.hidden=mime.value!=='image/jpeg';}
   $('#signature-export-note').textContent=master?'The export keeps available source-resolution detail and outputs a lossless PNG. It cannot recover detail absent from the uploaded image.':'Exact-size images meet your selected pixel dimensions. Small raster images may look blocky when magnified.';
   resetResult();
 }));
 mime.addEventListener('change',()=>{
  qualityField.hidden=mime.value!=='image/jpeg';
  if(purpose.value==='signature'&&mime.value==='image/jpeg')$('#transparent').checked=false;
  resetResult();
 });
 $('#transparent').addEventListener('change',()=>{if($('#transparent').checked){mime.value='image/png';qualityField.hidden=true;}resetResult();});
 for(const id of ['trim','enhance'])$("#"+id).addEventListener('change',resetResult);
 qualityField.hidden=false;
}
btn.addEventListener('click',async()=>{
 if(!selected)return;resetResult();btn.disabled=true;btn.textContent='Processing locally…';notify('Processing in your browser. Large images may take a few seconds.');
 try{
 let out,mime,ext;
 if(task==='compress'){
  mime=$('#mime').value;const target=num('#target',2,25000,'Target KB');out=await compressToBytes(selected,{targetBytes:target*1024,mime,allowShrink:$('#shrink').checked});ext=mime==='image/webp'?'webp':'jpg';
 }else if(task==='resize'){
  mime=$('#mime').value;const width=num('#width',1,12000,'Width'),height=num('#height',1,12000,'Height');
  if($('#purpose').value==='signature'){
   const outputMode=document.querySelector('input[name="signature-export"]:checked')?.value||'exact';
   out=await resizeSignature(selected,{width,height,mime,trim:$('#trim').checked,enhance:$('#enhance').checked,transparent:$('#transparent').checked,outputMode});
  }else{
   out=await resizeQuality(selected,{width,height,fit:$('#fit').value,mime,quality:Number($('#quality').value)/100});
  }
  ext=mime==='image/png'?'png':'jpg';
 }else{
  mime=$('#mime').value;out=await convert(selected,{mime,quality:Number($('#quality').value)/100});ext=mime.split('/')[1]==='jpeg'?'jpg':mime.split('/')[1];
 }
 if(!out?.blob)throw new Error('Unable to produce an output file.');
 downloadUrl=URL.createObjectURL(out.blob);download.href=downloadUrl;
 const master=task==='resize'&&$('#purpose').value==='signature'&&document.querySelector('input[name="signature-export"]:checked')?.value==='master';
 download.download=`${safeFileName(selected.name)}-${master?'signature-master':'mohsin-tools'}.${ext}`;
 const caption=`${formatBytes(out.blob.size)} · ${out.width} × ${out.height} · ${ext.toUpperCase()}`;
 resultDetails.textContent=caption;
 const preview=$('#result-preview');if(preview)preview.src=downloadUrl;
 lastProcessed={width:out.width,height:out.height,src:downloadUrl};
 const zoomImage=$('#zoom-image');if(zoomImage){zoomImage.src=downloadUrl;setZoom(1);const note=$('#zoom-caution');if(note&&task==='resize')note.textContent=$('#purpose').value==='signature'&&document.querySelector('input[name="signature-export"]:checked')?.value==='master'?'This master preserves available source detail. Strong magnification of any raster file eventually reveals pixels.':'This is the exact-size application output. At 200% or 400% you will see its pixels; choose High-resolution master to preserve more detail.';}
 result.classList.add('show');
 if(task==='compress'&&!out.metTarget){notify(`Could not meet the chosen limit. Smallest result: ${formatBytes(out.blob.size)}. Try enabling resizing or increasing the target.`, 'error');}
 else notify('Processed successfully. Inspect the preview, then download your file.','success');
 }catch(e){notify(e?.message||'Processing failed. Try another image.','error');}
 finally{btn.disabled=!selected;btn.textContent=btn.dataset.label;}
});
window.addEventListener('pagehide',()=>{if(thumbnailUrl)URL.revokeObjectURL(thumbnailUrl);if(downloadUrl)URL.revokeObjectURL(downloadUrl)});

function setZoom(factor){
 if(!lastProcessed||!$('#zoom-image'))return;
 const img=$('#zoom-image');img.style.width=`${lastProcessed.width*factor}px`;img.style.height=`${lastProcessed.height*factor}px`;
 document.querySelectorAll('[data-zoom]').forEach(btn=>btn.setAttribute('aria-pressed',String(Number(btn.dataset.zoom)===factor)));
}
document.querySelectorAll('[data-zoom]').forEach(btn=>btn.addEventListener('click',()=>setZoom(Number(btn.dataset.zoom))));
