import {cp, mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)), '..');
const dist=join(root,'dist');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
for(const item of ['index.html','privacy.html','robots.txt','sitemap.xml','_headers','assets','tools']){
 await cp(join(root,item),join(dist,item),{recursive:true});
}
console.log('Static build complete: dist/');
