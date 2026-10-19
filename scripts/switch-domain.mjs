/** Run only once the new Pages URL is confirmed and the redirect plan is ready. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const next=(process.argv[2]||'').replace(/\/$/,'');
if (!/^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(next)) {
 console.error('Supply the confirmed Cloudflare Pages URL: node scripts/switch-domain.mjs https://your-name.pages.dev');process.exit(1);
}
const old='https://tools.mohsinlabs.com';
const files=['index.html','privacy.html','robots.txt','sitemap.xml'];
for (const file of await readdir(join(root,'tools'))) if(file.endsWith('.html')) files.push('tools/'+file);
let changed=0;
for(const path of files){const file=join(root,path);const content=await readFile(file,'utf8');
 if(content.includes(old)){await writeFile(file,content.replaceAll(old,next));changed++;}}
console.log(`Updated ${changed} source files to ${next}. Review and commit after verifying redirects.`);
