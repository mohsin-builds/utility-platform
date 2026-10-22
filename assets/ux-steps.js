/**
 * Shared, dependency-free UX layer for all tool pages.
 * Adds discoverable upload, processing, and download steps without changing tool engines.
 */
const form=document.querySelector('main form');
if(form){
 const fileInputs=[...form.querySelectorAll('input[type="file"]')];
 const candidates=['file','files','pdf-files','source-file','ext-source','image-files','file-input','scanned-files','photo','signature'];
 const input=fileInputs.find(el=>candidates.includes(el.id))||fileInputs[0];
 const multipleInputs=fileInputs.length>1;
 const wrapper=document.createElement('section');
 wrapper.className='ux-steps';
 wrapper.setAttribute('aria-label','Simple tool workflow');
 wrapper.innerHTML='<div class="ux-steps-heading"><strong>Three simple steps</strong><span>Private file processing where supported</span></div><ol class="ux-step-list"><li data-step="1"><span class="ux-number">1</span><span>Choose your file</span></li><li data-step="2"><span class="ux-number">2</span><span>Adjust options & process</span></li><li data-step="3"><span class="ux-number">3</span><span>Download your result</span></li></ol><p class="ux-selection" role="status" aria-live="polite">Start by choosing '+(multipleInputs?'the files you need.':'a file.')+'</p>';
 form.parentNode.insertBefore(wrapper,form);
 const steps=[...wrapper.querySelectorAll('[data-step]')],selection=wrapper.querySelector('.ux-selection');
 let stage=1,ready=false;
 const updateStage=(step)=>{
  stage=step;
  steps.forEach((el,i)=>{
    const n=i+1,active=n===step;
    el.classList.toggle('ux-active',active);
    el.classList.toggle('ux-done',n<step);
    if(active)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
  });
 };
 updateStage(1);
 function selectedFiles(){
  return fileInputs.flatMap(el=>[...(el.files||[])]);
 }
 function refresh(){
  const files=selectedFiles();
  ready=files.length>0;
  if(!files.length){selection.textContent='Start by choosing '+(multipleInputs?'the files you need.':'a file.');updateStage(1);return;}
  const size=files.reduce((sum,file)=>sum+file.size,0);
  const names=files.slice(0,3).map(file=>file.name).join(', ');
  selection.textContent=(files.length===1?'Selected: ':'Selected '+files.length+' files: ')+names+(files.length>3?' and '+(files.length-3)+' more':'')+' · '+(size/1024/1024).toFixed(2)+' MB';
  updateStage(2);
 }
 for(const el of fileInputs)el.addEventListener('change',refresh);
 // Drag-drop only on a single unambiguous file picker.
 if(fileInputs.length===1&&input){
  const host=input.parentElement;
  if(host){
   host.classList.add('ux-upload');
   host.title='Click to choose files, or drop files here';
   for(const name of ['dragenter','dragover'])host.addEventListener(name,e=>{if(e.dataTransfer?.types?.includes('Files')){e.preventDefault();host.classList.add('ux-dragover');}});
   for(const name of ['dragleave','drop'])host.addEventListener(name,e=>{e.preventDefault();host.classList.remove('ux-dragover');});
   host.addEventListener('drop',event=>{
    const dropped=[...(event.dataTransfer?.files||[])];
    if(!dropped.length)return;
    try{
      const transfer=new DataTransfer();
      (input.multiple?dropped:dropped.slice(0,1)).forEach(f=>transfer.items.add(f));
      input.files=transfer.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }catch{selection.textContent='Drag-and-drop is unavailable here. Use Choose file instead.';}
   });
  }
 }
 const resultIds=['pdf-results','pdf-result','results','result','image-results','image-result','task-result','ext-result','pack-results','utility-result','download-area'];
 const outputs=resultIds.map(id=>document.getElementById(id)).filter(Boolean);
 const statusIds=['pdf-status','status','task-message','task-status','ext-status','image-status','pack-status','utility-status'];
 const statuses=statusIds.map(id=>document.getElementById(id)).filter(Boolean);
 const success=()=>outputs.some(el=>!el.hidden&&!!el.querySelector('a[download],a[href^="blob:"]'));
 const error=()=>statuses.some(el=>el.dataset.error==='true'||el.classList.contains('error'));
 let hadSubmit=false;
 const inspect=()=>{
  if(success()){updateStage(3);selection.textContent='Your result is ready. Use the download link below to save it.';return;}
  if(hadSubmit&&error()){updateStage(2);selection.textContent='The tool reported a problem. Review the message below, adjust your options, and try again.';}
 };
 const observer=new MutationObserver(inspect);
 outputs.forEach(node=>observer.observe(node,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','href']}));
 statuses.forEach(node=>observer.observe(node,{childList:true,subtree:true,attributes:true,attributeFilter:['data-error','class','hidden'],characterData:true}));
 form.addEventListener('submit',()=>{hadSubmit=true;updateStage(2);if(ready)selection.textContent='Working on your file…';},true);
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
