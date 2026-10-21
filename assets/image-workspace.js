import {createZip} from './pack-core.mjs';
const $=id=>document.getElementById(id);
const mode=document.body.dataset.mode,form=$('image-form'),input=$('image-files'),result=$('image-results'),status=$('image-status'),submit=$('image-submit');
let urls=[],previewBitmap=null,selection=null,dragStart=null,dragEnd=null;
const maxFile=25*1024*1024,maxPixels=24_000_000;
const types=new Set(['image/jpeg','image/png','image/webp']);
function say(text,error=false){status.textContent=text;status.dataset.error=String(error);}
function clearResults(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];result.replaceChildren();result.hidden=true;}
function number(id,lo,hi){const n=Number($(id).value);if(!Number.isFinite(n)||n<lo||n>hi)throw Error(id+' must be between '+lo+' and '+hi);return n;}
function safeName(n){return n.replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]/ig,'-').slice(0,60)||'image';}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');urls.push(url);a.href=url;a.download=name;a.className='img-download';a.textContent='Download '+name;result.append(a);result.hidden=false;}
async function bitmap(file){
 if(!file||!types.has(file.type))throw Error('Choose a JPG, PNG or WebP image.');
 if(file.size>maxFile)throw Error('Images must be under 25 MB each.');
 let image;try{image=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('This browser could not read the selected image.');}
 if(image.width*image.height>maxPixels){image.close();throw Error('Image exceeds the 24-megapixel limit.');}
 return image;
}
function newCanvas(w,h){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>12000||h>12000||w*h>maxPixels)throw Error('Output must be within 12,000 pixels per side and 24 megapixels.');
 const c=document.createElement('canvas');c.width=w;c.height=h;return c;
}
function ctx2d(canvas){const context=canvas.getContext('2d');if(!context)throw Error('Canvas is not supported by this browser.');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';return context;}
function canvasBlob(canvas,type='image/png',quality=.91){return new Promise((resolve,reject)=>canvas.toBlob(b=>b&&b.type===type?resolve(b):reject(Error('Failed to encode '+type+'.')),type,quality));}
const ext=type=>type==='image/jpeg'?'jpg':type==='image/webp'?'webp':'png';
function drawRotated(image){
 const angle=Number($('angle').value),flip=$('flip').value,odd=angle===90||angle===270,canvas=newCanvas(odd?image.height:image.width,odd?image.width:image.height),ctx=ctx2d(canvas);
 ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);ctx.scale(flip==='horizontal'?-1:1,flip==='vertical'?-1:1);ctx.drawImage(image,-image.width/2,-image.height/2);return canvas;
}
function drawWatermark(image){
 const canvas=newCanvas(image.width,image.height),ctx=ctx2d(canvas);ctx.drawImage(image,0,0);
 const text=$('mark').value.trim();if(!text||text.length>80)throw Error('Enter watermark text (1–80 characters).');
 const size=Math.max(18,Math.round(canvas.width/19));
 ctx.font='800 '+size+'px sans-serif';const measure=ctx.measureText(text).width;
 let fontSize=size;if(measure>canvas.width*.9)fontSize=Math.max(10,Math.floor(size*canvas.width*.9/measure));
 ctx.font='800 '+fontSize+'px sans-serif';ctx.textBaseline='middle';ctx.lineWidth=Math.max(1,fontSize/12);
 const m=Math.max(12,Math.round(Math.min(canvas.width,canvas.height)*.05)),position=$('position').value;
 let x=canvas.width/2,y=canvas.height/2;ctx.textAlign='center';
 if(position.includes('left')){x=m;ctx.textAlign='left';}if(position.includes('right')){x=canvas.width-m;ctx.textAlign='right';}
 if(position.startsWith('top'))y=m+fontSize/2;if(position.startsWith('bottom'))y=canvas.height-m-fontSize/2;
 ctx.globalAlpha=number('opacity',10,100)/100;ctx.strokeStyle='#16202c';ctx.fillStyle=$('mark-color').value;ctx.strokeText(text,x,y,canvas.width-2*m);ctx.fillText(text,x,y,canvas.width-2*m);ctx.globalAlpha=1;return canvas;
}
function caption(ctx,txt,x,y,width,fromBottom=false){
 const words=txt.toUpperCase().trim().split(/\s+/).filter(Boolean);if(!words.length)return;
 let size=Math.max(20,Math.round(width/12));ctx.textAlign='center';ctx.lineJoin='round';
 function wrap(){
  ctx.font='900 '+size+'px Impact,Arial Black,sans-serif';const lines=[];let line='';
  for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width*.91&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;
 }
 let lines=wrap();while((lines.length*size*1.18>ctx.canvas.height*.37||lines.some(l=>ctx.measureText(l).width>width*.94))&&size>15){size--;lines=wrap();}
 ctx.font='900 '+size+'px Impact,Arial Black,sans-serif';ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.strokeStyle='#000';ctx.lineWidth=Math.max(3,Math.round(size/10));
 const spacing=size*1.1,start=fromBottom?ctx.canvas.height-15-spacing*lines.length:15;
 lines.forEach((line,i)=>{const y=start+i*spacing;ctx.strokeText(line,x,y,width*.94);ctx.fillText(line,x,y,width*.94);});
}
function drawMeme(image){const canvas=newCanvas(image.width,image.height),ctx=ctx2d(canvas);ctx.drawImage(image,0,0);caption(ctx,$('top-caption').value,canvas.width/2,0,canvas.width);caption(ctx,$('bottom-caption').value,canvas.width/2,0,canvas.width,true);return canvas;}
function drawEdited(image){const canvas=newCanvas(image.width,image.height),ctx=ctx2d(canvas);ctx.filter='brightness('+number('brightness',50,150)+'%) contrast('+number('contrast',50,150)+'%) saturate('+number('saturation',0,200)+'%)';ctx.drawImage(image,0,0);ctx.filter='none';return canvas;}
function drawEnlarged(image){const factor=number('scale',2,4),canvas=newCanvas(image.width*factor,image.height*factor);ctx2d(canvas).drawImage(image,0,0,canvas.width,canvas.height);return canvas;}
function previewCanvas(){return $('selection-canvas')}
function canvasCoords(e){const c=previewCanvas(),r=c.getBoundingClientRect();return {x:Math.min(c.width,Math.max(0,(e.clientX-r.left)*c.width/r.width)),y:Math.min(c.height,Math.max(0,(e.clientY-r.top)*c.height/r.height))};}
function preview(){
 const c=previewCanvas();if(!c||!previewBitmap)return;
 const factor=Math.min(1,880/previewBitmap.width,530/previewBitmap.height);c.width=Math.max(1,Math.round(previewBitmap.width*factor));c.height=Math.max(1,Math.round(previewBitmap.height*factor));
 const ctx=ctx2d(c);ctx.drawImage(previewBitmap,0,0,c.width,c.height);
 const area=dragStart&&dragEnd?{x:Math.min(dragStart.x,dragEnd.x),y:Math.min(dragStart.y,dragEnd.y),w:Math.abs(dragStart.x-dragEnd.x),h:Math.abs(dragStart.y-dragEnd.y)}:selection;
 if(area){ctx.strokeStyle='#ef6146';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.strokeRect(area.x,area.y,area.w,area.h);}
}
function initSelection(){
 const c=previewCanvas();if(!c)return;
 c.addEventListener('pointerdown',e=>{if(!previewBitmap)return;c.setPointerCapture(e.pointerId);dragStart=canvasCoords(e);dragEnd=dragStart;preview();});
 c.addEventListener('pointermove',e=>{if(!dragStart)return;dragEnd=canvasCoords(e);preview();});
 c.addEventListener('pointerup',e=>{if(!dragStart)return;dragEnd=canvasCoords(e);const w=Math.abs(dragEnd.x-dragStart.x),h=Math.abs(dragEnd.y-dragStart.y);
 selection=w>4&&h>4?{x:Math.min(dragStart.x,dragEnd.x),y:Math.min(dragStart.y,dragEnd.y),w,h}:null;dragStart=null;dragEnd=null;preview();if(selection)say('Region selected. Choose blur or solid cover, then process.');});
 c.addEventListener('pointercancel',()=>{dragStart=null;dragEnd=null;preview();});
 $('clear-selection')?.addEventListener('click',()=>{selection=null;dragStart=null;dragEnd=null;preview();say('Selection cleared.')});
}
function blurCanvas(image){
 if(!selection)throw Error('Drag a rectangle across the preview first.');
 const canvas=newCanvas(image.width,image.height),ctx=ctx2d(canvas),p=previewCanvas();
 const scaleX=image.width/p.width,scaleY=image.height/p.height;
 const x=Math.floor(selection.x*scaleX),y=Math.floor(selection.y*scaleY),w=Math.ceil(selection.w*scaleX),h=Math.ceil(selection.h*scaleY);
 ctx.drawImage(image,0,0);const mode=$('mask-mode').value;
 if(mode==='cover'){ctx.fillStyle='#000';ctx.fillRect(x,y,w,h);}
 else{
  const radius=Math.max(14,Math.round(Math.min(w,h)*.11)),tmp=newCanvas(w,h),tctx=ctx2d(tmp);
  tctx.filter='blur('+radius+'px)';tctx.drawImage(canvas,x,y,w,h,0,0,w,h);tctx.filter='none';ctx.drawImage(tmp,x,y);
 }
 return canvas;
}
function ensureFiles(){
 const files=[...input.files];
 if(!files.length)throw Error('Choose an image first.');
 if((mode==='rotate'||mode==='watermark')&&files.length>15)throw Error('Maximum 15 images per batch.');
 if(mode!=='rotate'&&mode!=='watermark'&&files.length!==1)throw Error('Choose one image.');
 return files;
}
input.addEventListener('change',async()=>{
 clearResults();selection=null;dragStart=null;dragEnd=null;
 if(previewBitmap){previewBitmap.close();previewBitmap=null;}
 if(mode==='blur'&&input.files[0])try{previewBitmap=await bitmap(input.files[0]);preview();say('Drag a rectangle on the preview.');}catch(e){say(e.message,true);}
 else say(input.files.length+' image(s) selected.');
});
initSelection();
form.addEventListener('submit',async e=>{
 e.preventDefault();clearResults();submit.disabled=true;say('Processing locally…');
 try{
  const files=ensureFiles(),type=$('mime')?.value||'image/png';
  const entries=[];
  for(let i=0;i<files.length;i++){
   const image=mode==='blur'&&previewBitmap?previewBitmap:await bitmap(files[i]);
   let canvas;
   try{
    if(mode==='rotate')canvas=drawRotated(image);
    else if(mode==='watermark')canvas=drawWatermark(image);
    else if(mode==='meme')canvas=drawMeme(image);
    else if(mode==='blur')canvas=blurCanvas(image);
    else if(mode==='editor')canvas=drawEdited(image);
    else if(mode==='enlarge')canvas=drawEnlarged(image);
    else throw Error('Unsupported operation.');
    const blob=await canvasBlob(canvas,type),name=safeName(files[i].name)+'-'+mode+'.'+ext(type);
    entries.push({name,blob});canvas.width=canvas.height=0;
   }finally{if(image!==previewBitmap)image.close();}
   say('Processed '+(i+1)+' of '+files.length+' images.');
  }
  if(entries.length===1)download(entries[0].blob,entries[0].name);
  else download(await createZip(entries),'image-batch.zip');
  say('Complete. Download and review the processed image'+(entries.length>1?'s':'')+'.');
 }catch(error){say(error.message||'Image processing failed.',true)}
 finally{submit.disabled=false;}
});
window.addEventListener('pagehide',()=>{clearResults();previewBitmap?.close();});
