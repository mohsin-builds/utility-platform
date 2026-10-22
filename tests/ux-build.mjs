import {strict as assert} from 'node:assert';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const dir=new URL('../dist/tools/',import.meta.url);
const files=(await readdir(dir)).filter(n=>n.endsWith('.html'));
assert(files.length>=56,'Expected all existing tool pages');
for(const f of files){
 const html=await readFile(join(dir.pathname,f),'utf8');
 assert(html.includes('/assets/ux-steps.js'),'UX script missing on '+f);
 assert(html.includes('/assets/ux-steps.css'),'UX stylesheet missing on '+f);
 assert(html.includes('type="file"')||html.includes('<form'),'No input or form found on '+f);
}
console.log('Unified 3-step UX applied to '+files.length+' tool pages.');
