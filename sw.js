const C='safety-v6';
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','seed.js','timesheet.html','timesheet.html?v=6','tb.png','img/hero.jpg','img/hardhat.jpg','img/clipboard.jpg','img/tablet.jpg','jha.png','manifest.json','icon.png','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js']))) });
self.addEventListener('fetch',e=>{if(e.request.method!='GET'||e.request.url.includes('supabase'))return;e.respondWith(fetch(e.request).then(r=>{const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));return r}).catch(()=>caches.match(e.request)))});
