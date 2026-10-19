const allowed=new Set(['image/jpeg','image/png','image/webp']);
export const formatBytes=(n)=>n<1024?`${n} B`:n<1024**2?`${(n/1024).toFixed(1)} KB`:`${(n/1024**2).toFixed(2)} MB`;
export function safeFileName(n){return (n.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(0,90)||'image')}
export async function loadBitmap(file){
 if(!file)throw new Error('Choose an image first.');
 if(!allowed.has(file.type))throw new Error('This browser-only version supports JPG, PNG and WebP. HEIC/HEIF support is not included yet.');
 if(file.size>25*1024*1024)throw new Error('Maximum upload size is 25 MB for this initial version.');
 let img;try{img=await createImageBitmap(file)}catch{throw new Error('This image could not be decoded by your browser. Try another JPG, PNG or WebP file.');}
 if(img.width*img.height>50_000_000){img.close();throw new Error('This image exceeds the 50-megapixel safety limit.');}
 return img;
}
export function drawBitmap(img,width,height,fit='contain',background='#ffffff',preserveAlpha=false){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:preserveAlpha});if(!ctx)throw new Error('Canvas is unavailable in this browser.');
 if(!preserveAlpha){ctx.fillStyle=background;ctx.fillRect(0,0,width,height);}
 const iw=img.width,ih=img.height;
 let x=0,y=0,w=width,h=height;
 if(fit==='cover') {const ratio=Math.max(width/iw,height/ih);w=iw*ratio;h=ih*ratio;x=(width-w)/2;y=(height-h)/2;}
 else if(fit==='contain') {const ratio=Math.min(width/iw,height/ih);w=iw*ratio;h=ih*ratio;x=(width-w)/2;y=(height-h)/2;}
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,x,y,w,h);return canvas;
}
export function canvasBlob(canvas,mime,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not encode image. Try a different format.')),mime,quality));}
export async function convert(file,{mime='image/jpeg',quality=.88,width=null,height=null,fit='contain'}={}){
 const img=await loadBitmap(file);
 try{
 const w=width||img.width,h=height||img.height;
 if(w<1||h<1||w>12000||h>12000||w*h>50_000_000)throw new Error('Output dimensions must be below 50 megapixels and 12,000 pixels per side.');
 const preserveAlpha = mime !== 'image/jpeg' && !width && !height;
 const canvas=drawBitmap(img,w,h,fit,'#ffffff',preserveAlpha);const blob=await canvasBlob(canvas,mime,quality);
 if(blob.type!==mime)throw new Error('Your browser does not support this output format.');
 return {blob,width:w,height:h};
 }finally{img.close();}
}
// Binary quality search for a JPEG/WebP target, then proportional resolution reduction.
// Reports failure rather than claiming success if the exact byte ceiling cannot be reached.
export async function compressToBytes(file,{targetBytes,mime='image/jpeg',width=null,height=null,fit='contain',allowShrink=true}={}){
 if(!Number.isFinite(targetBytes)||targetBytes<2048)throw new Error('Target must be at least 2 KB.');
 if(targetBytes>25*1024*1024)throw new Error('Target cannot exceed 25 MB.');
 if(!['image/jpeg','image/webp'].includes(mime))throw new Error('Exact-size compression works with JPG or WebP.');
 const img=await loadBitmap(file);
 try{
 let w=width||img.width,h=height||img.height;
 if(w<1||h<1||w>12000||h>12000||w*h>50_000_000)throw new Error('Dimensions exceed the safety limit.');
 const fixed=Boolean(width&&height); let smallest=null;
 for(let step=0;step<(allowShrink&&!fixed?12:1);step++){
 const canvas=drawBitmap(img,w,h,fit);
 let lo=.06,hi=.95,best=null;
 // First try highest quality directly: avoid unnecessary lossy encoding.
 const high=await canvasBlob(canvas,mime,hi);
 if(high.type!==mime)throw new Error('Your browser does not support the selected output format.');
 if(high.size<=targetBytes)best=high;
 else{
  for(let i=0;i<12;i++){
   const q=(lo+hi)/2;const b=await canvasBlob(canvas,mime,q);
   if(b.size<=targetBytes){best=b;lo=q;}else{hi=q;}
  }
 }
 if(best)return {blob:best,width:w,height:h,metTarget:true};
 const low=await canvasBlob(canvas,mime,.06);
 if(!smallest||low.size<smallest.blob.size)smallest={blob:low,width:w,height:h,metTarget:false};
 if(fixed||!allowShrink||Math.min(w,h)<=24)break;
 const scale=Math.min(.84,Math.max(.42,Math.sqrt(targetBytes/Math.max(low.size,1))*.88));
 const nw=Math.max(1,Math.floor(w*scale)),nh=Math.max(1,Math.floor(h*scale));
 if(nw===w&&nh===h)break;w=nw;h=nh;
 }
 return smallest;
 }finally{img.close();}
}

// Higher fidelity downscaling: reduce large images in stages instead of asking
// one Canvas draw call to discard almost all source pixels at once.
function stagedDraw(ctx,source,sx,sy,sw,sh,dx,dy,dw,dh){
 let current=source,cw=sw,ch=sh,cx=sx,cy=sy;
 while(cw>dw*2.1 && ch>dh*2.1){
  const nw=Math.max(1,Math.round(cw/2)),nh=Math.max(1,Math.round(ch/2));
  const intermediate=document.createElement('canvas');intermediate.width=nw;intermediate.height=nh;
  const ictx=intermediate.getContext('2d',{alpha:true});
  if(!ictx)throw new Error('Canvas is unavailable in this browser.');
  ictx.imageSmoothingEnabled=true;ictx.imageSmoothingQuality='high';
  ictx.drawImage(current,cx,cy,cw,ch,0,0,nw,nh);
  current=intermediate;cw=nw;ch=nh;cx=0;cy=0;
 }
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(current,cx,cy,cw,ch,dx,dy,dw,dh);
}

export async function resizeQuality(file,{width,height,fit='contain',mime='image/jpeg',quality=.97}={}){
 const img=await loadBitmap(file);
 try{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>12000||height>12000||width*height>50_000_000)throw new Error('Output dimensions exceed the safety limit.');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:mime!=='image/jpeg'});
  if(!ctx)throw new Error('Canvas is unavailable in this browser.');
  if(mime==='image/jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height)}
  const ratio=fit==='cover'?Math.max(width/img.width,height/img.height):Math.min(width/img.width,height/img.height);
  const drawW=img.width*ratio,drawH=img.height*ratio;
  if(fit==='cover'){
   const sw=width/ratio,sh=height/ratio;
   stagedDraw(ctx,img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,0,0,width,height);
  }else{
   stagedDraw(ctx,img,0,0,img.width,img.height,(width-drawW)/2,(height-drawH)/2,drawW,drawH);
  }
  const blob=await canvasBlob(canvas,mime,quality);
  if(blob.type!==mime)throw new Error('Your browser does not support the selected output format.');
  return {blob,width,height};
 }finally{img.close()}
}

// Purpose-built for handwriting on white/light paper. We detect ink, remove
// faint background noise, optionally trim empty margins, and export crisp PNG.
// This is intentionally local-only and does not claim to restore lost detail.
export async function resizeSignature(file,{width,height,mime='image/png',transparent=false,trim=true,enhance=true,outputMode='exact'}={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>12000||height>12000||width*height>50_000_000)throw new Error('Output dimensions exceed the safety limit.');
 if(!['exact','master'].includes(outputMode))throw new Error('Unknown signature export type.');
 if(outputMode==='master'&&mime!=='image/png')throw new Error('High-resolution master requires PNG output.');
 if(transparent&&mime!=='image/png')throw new Error('Transparent signatures require PNG output.');
 if(!['image/png','image/jpeg'].includes(mime))throw new Error('Signature output must be JPG or PNG.');
 const img=await loadBitmap(file);
 try{
  const scale=Math.min(1,3600/Math.max(img.width,img.height),Math.sqrt(12_000_000/(img.width*img.height)));
  const sw=Math.max(1,Math.round(img.width*scale)),sh=Math.max(1,Math.round(img.height*scale));
  const source=document.createElement('canvas');source.width=sw;source.height=sh;
  const sctx=source.getContext('2d',{willReadFrequently:true});
  if(!sctx)throw new Error('Canvas is unavailable in this browser.');
  sctx.drawImage(img,0,0,sw,sh);
  const original=sctx.getImageData(0,0,sw,sh),data=original.data;
  // Detect already-transparent files so we preserve their actual alpha mask.
  let transparentCount=0;
  for(let i=3;i<data.length;i+=4*37)if(data[i]<220)transparentCount++;
  const originallyTransparent=transparentCount>Math.max(4,(data.length/4/37)*.015);
  let rsum=0,gsum=0,bsum=0,total=0;
  for(let i=0;i<data.length;i+=4*3){
   const a=data[i+3]/255;
   const darkness=255-(.299*data[i]+.587*data[i+1]+.114*data[i+2]);
   if(a>.5&&darkness>100){const weight=(darkness-100)*a;rsum+=data[i]*weight;gsum+=data[i+1]*weight;bsum+=data[i+2]*weight;total+=weight;}
  }
  // Preserve the general ink hue; darken light pen strokes for legibility.
  const ink=total>0?
   [rsum/total,gsum/total,bsum/total].map(v=>Math.round(Math.max(0,Math.min(112,v*.73)))):
   [20,35,54];
  let left=sw,top=sh,right=-1,bottom=-1,visible=0;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
   const i=(y*sw+x)*4;
   const originalAlpha=data[i+3]/255;
   const darkness=255-(.299*data[i]+.587*data[i+1]+.114*data[i+2]);
   let opacity;
   if(originallyTransparent){
    opacity=originalAlpha * (darkness<10?.85:1);
   }else{
    // Offset removes near-white compression noise; smooth gamma protects
    // antialiased hairline strokes against disappearance after resizing.
    opacity=Math.max(0,Math.min(1,(darkness-(enhance?12:5))/(enhance?108:150)));
    if(enhance)opacity=Math.pow(opacity,.72);
   }
   const alpha=Math.round(opacity*255);
   data[i]=ink[0];data[i+1]=ink[1];data[i+2]=ink[2];data[i+3]=alpha;
   if(alpha>54){visible++;if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y;}
  }
  if(visible<4)throw new Error('No clear signature strokes found. Try an image with dark ink on plain light paper, or use Photo mode.');
  sctx.clearRect(0,0,sw,sh);sctx.putImageData(original,0,0);
  let cx=0,cy=0,cw=sw,ch=sh;
  if(trim){
   const marginX=Math.max(2,Math.round((right-left+1)*.045));
   const marginY=Math.max(2,Math.round((bottom-top+1)*.09));
   cx=Math.max(0,left-marginX);cy=Math.max(0,top-marginY);
   cw=Math.min(sw-cx,right+marginX+1-cx);ch=Math.min(sh-cy,bottom+marginY+1-cy);
  }
  // A master keeps the available cleaned source pixels instead of needlessly
  // collapsing them to the tiny dimensions expected by application forms.
  // We never upscale beyond the source; no missing details are invented.
  const ow=outputMode==='master'?cw:width,oh=outputMode==='master'?ch:height;
  const out=document.createElement('canvas');out.width=ow;out.height=oh;
  const ctx=out.getContext('2d',{alpha:true});if(!ctx)throw new Error('Canvas is unavailable in this browser.');
  const ratio=Math.min(ow/cw,oh/ch),dw=cw*ratio,dh=ch*ratio;
  // Resample the transparency mask first, then composite on white if requested.
  stagedDraw(ctx,source,cx,cy,cw,ch,(ow-dw)/2,(oh-dh)/2,dw,dh);
  if(!transparent){
   const white=document.createElement('canvas');white.width=ow;white.height=oh;
   const wctx=white.getContext('2d',{alpha:false});if(!wctx)throw new Error('Canvas is unavailable in this browser.');
   wctx.fillStyle='#ffffff';wctx.fillRect(0,0,ow,oh);wctx.drawImage(out,0,0);
   const blob=await canvasBlob(white,mime,mime==='image/jpeg'?.98:undefined);
   if(blob.type!==mime)throw new Error('Your browser does not support the output format.');
   return {blob,width:ow,height:oh};
  }
  const blob=await canvasBlob(out,'image/png');
  if(blob.type!=='image/png')throw new Error('PNG export is unavailable in this browser.');
  return {blob,width:ow,height:oh};
 }finally{img.close()}
}
