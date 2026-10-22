import {cp, mkdir, rm, readdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)), '..');
const dist=join(root,'dist');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
for(const item of ['index.html','privacy.html','robots.txt','sitemap.xml','_headers','assets','tools']){
 await cp(join(root,item),join(dist,item),{recursive:true});
}
// Keep one shared user journey across new and legacy tools without editing each engine.
const toolRoot=join(dist,'tools');
let wired=0;
for(const name of await readdir(toolRoot)){
 if(!name.endsWith('.html'))continue;
 const pathname=join(toolRoot,name),html=await readFile(pathname,'utf8');
 if(!html.includes('</head>')||!html.includes('</body>'))throw Error('Invalid HTML shell: '+name);
 const withAssets=html
  .replace('</head>','<link rel="stylesheet" href="/assets/ux-steps.css"></head>')
  .replace('</body>','<script type="module" src="/assets/ux-steps.js"></script></body>');
 await writeFile(pathname,withAssets);
 wired++;
}
console.log('Static build complete: dist/ with '+wired+' unified tool journeys.');
