/* Only this generic fallback is stored. No runtime page, API, photo or RSC caching. */
const CACHE = "petish-offline-e1b93851a237";
const OFFLINE='/offline.html';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{const response=await fetch(OFFLINE,{cache:'reload',credentials:'omit'});if(!response.ok)throw new Error('Offline screen unavailable');await cache.put(OFFLINE,response);}));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('petish-offline-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')void self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.mode!=='navigate'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{try{return await fetch(request,{cache:'no-store'});}catch{return (await caches.match(OFFLINE,{cacheName:CACHE}))||new Response('Petish needs a connection. Reconnect and reload.',{status:503,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});}})());
});
