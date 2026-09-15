import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const hash=createHash('sha256');
async function walk(dir){for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(item.name==='generated')continue;const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else{hash.update(file);hash.update(await readFile(file));}}}
await walk('src');for(const file of ['package.json','package-lock.json','public/offline.html'])hash.update(await readFile(file));
const version=hash.digest('hex').slice(0,12),file='public/sw.js';const source=await readFile(file,'utf8');
await writeFile(file,source.replace(/const CACHE\s*=\s*['"]petish-offline-[^'"]+['"];/,`const CACHE = "petish-offline-${version}";`));
console.log(`PWA release ${version}`);
