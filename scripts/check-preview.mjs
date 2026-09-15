import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {url}=JSON.parse(await readFile('.local/phone-preview/preview.json','utf8'));
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
try{
 const res=await page.goto(url+'/install',{waitUntil:'networkidle',timeout:60000});assert.equal(res.status(),200);assert.equal(await page.evaluate(()=>window.isSecureContext),true);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 const cdp=await context.newCDPSession(page);const metadata=await cdp.send('Page.getAppManifest');assert.deepEqual(metadata.errors,[]);
 let installability;try{installability=await cdp.send('Page.getInstallabilityErrors');}catch{installability={notAvailable:true};}
 await page.goto(url+'/login');await page.getByRole('button',{name:'Explore the demo',exact:true}).click();await page.getByRole('heading',{name:'Hello, Sarah.'}).waitFor({timeout:20000});
 assert.equal((await page.request.get(url+'/api/local-mail')).status(),404);
 assert.equal((await page.request.post(url+'/api/auth/sign-up/email',{headers:{origin:url},data:{email:'not-created@example.test',password:'not-a-real-password',name:'Do not create'}})).status(),404);
 const pets=await(await page.request.get(url+'/api/pets')).json();assert.equal(pets.length,4);const milo=pets.find(p=>p.name==='Milo');
 const health=await(await page.request.get(url+'/api/health/'+milo.id)).json();assert.equal(health.records.length,10);
 const photo=health.records.flatMap(r=>r.attachments).find(f=>f.mime.startsWith('image/'));assert.ok(photo);assert.equal((await page.request.get(url+'/api/health-files/'+photo.id)).status(),200);
 const visitor=await browser.newContext();assert.equal((await visitor.request.get(url+'/api/health-files/'+photo.id)).status(),404);await visitor.close();
 // Upload a sample image through HTTPS to exercise request size, origin and session handling.
 const create=await page.request.post(url+'/api/health/'+milo.id,{headers:{origin:url},data:{kind:'NOTE',title:'HTTPS upload check — synthetic sample',notes:'Created by automated preview verification; safe to remove.'}});assert.equal(create.status(),201);const entry=await create.json();
 const upload=await page.request.post(url+'/api/health/'+milo.id+'/'+entry.id+'/files',{headers:{origin:url},multipart:{file:{name:'synthetic-demo.jpg',mimeType:'image/jpeg',buffer:await readFile('public/demo/tabby-kitten.jpg')},description:'Licensed sample image for HTTPS upload verification'}});assert.equal(upload.status(),201);const saved=await upload.json();
 const deleted=await page.request.delete(url+'/api/health/'+milo.id+'/'+entry.id,{headers:{origin:url},data:{version:saved.version}});assert.equal(deleted.status(),200);
 await page.goto(url+'/app/pets/'+milo.id+'/health');await page.getByRole('heading',{name:'Milo’s health.'}).waitFor();await page.screenshot({path:'.local/qa/pwa-https-health-mobile.png',fullPage:true});
 const caches=await page.evaluate(async()=>{const result=[];for(const key of await window.caches.keys())for(const req of await(await window.caches.open(key)).keys())result.push(new URL(req.url).pathname);return result;});assert.deepEqual(caches,['/offline.html']);
 await writeFile('.local/qa/pwa-https-check.json',JSON.stringify({url,https:true,manifestErrors:metadata.errors,installability,login:true,uploads:true,mailDisabled:true,signupDisabled:true,cacheEntries:caches,checkedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({https:true,manifestErrors:metadata.errors,installability,login:true,uploads:true,privateFiles:true,mailDisabled:true,signupDisabled:true,cacheEntries:caches}));
}finally{await browser.close();}
