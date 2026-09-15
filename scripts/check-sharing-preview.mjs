import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {url}=JSON.parse(await readFile('.local/phone-preview/preview.json','utf8'));
const browser=await chromium.launch();
const owner=await browser.newContext({viewport:{width:390,height:844}});
const anon=await browser.newContext({viewport:{width:390,height:844}});
const page=await owner.newPage(), recipient=await anon.newPage();
let api,share;
try {
 await page.goto(url+'/login',{timeout:60000});
 await page.getByRole('button',{name:'Explore the demo',exact:true}).click();
 await page.getByRole('heading',{name:'Hello, Sarah.'}).waitFor({timeout:30000});
 const pets=await(await owner.request.get(url+'/api/pets')).json();
 const pet=pets.find(p=>p.name==='Milo');assert.ok(pet);
 api=url+'/api/shares/'+pet.id;
 const preview=await owner.request.post(api+'/preview',{headers:{origin:url},data:{}});assert.equal(preview.status(),201);
 const draft=await preview.json();
 const issued=await owner.request.post(api+'/create',{headers:{origin:url},data:{snapshotId:draft.id,expiry:'HOUR',confirmBearer:true}});assert.equal(issued.status(),201);
 share=await issued.json();assert.ok(share.qr.startsWith('data:image/png;base64,'));
 const requests=[];recipient.on('request',r=>requests.push(r.url()));
 const response=await recipient.goto(share.url,{timeout:60000});
 assert.match(response.headers()['cache-control'],/no-store/);
 assert.equal(response.headers()['referrer-policy'],'no-referrer');
 await recipient.getByText('Read-only snapshot',{exact:true}).waitFor({timeout:30000});
 assert.ok(requests.every(u=>!u.includes(new URL(share.url).hash.slice(1))));
 assert.equal(await recipient.evaluate(()=>isSecureContext),true);
 await recipient.screenshot({path:'.local/qa/phase3-https-recipient.png',fullPage:true});
 assert.equal((await owner.request.delete(api+'/'+share.id,{headers:{origin:url}})).status(),200);
 await recipient.reload();await recipient.getByRole('status').filter({hasText:'unavailable'}).waitFor();
 await page.goto(url+'/app/pets/'+pet.id+'/health/shares');await page.getByRole('heading',{name:'Shared links.'}).waitFor();
 await page.screenshot({path:'.local/qa/phase3-https-owner.png',fullPage:true});
 const report={https:true,anonymousAccess:true,fragmentAbsentFromHttpUrls:true,noStore:true,noReferrer:true,qrGenerated:true,revocation:true,checkedAt:new Date().toISOString()};
 await writeFile('.local/qa/phase3-https-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {
 if(share)await owner.request.delete(api+'/'+share.id,{headers:{origin:url}}).catch(()=>{});
 await browser.close();
}

