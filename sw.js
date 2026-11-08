const C='safety-v4';
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','seed.js','timesheet.html','tb.png','jha.png','manifest.json','icon.png','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js']))));
self.addEventListener('fetch',e=>{if(e.request.method!='GET'||e.request.url.includes('supabase'))return;e.respondWith(fetch(e.request).then(r=>{const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));return r}).catch(()=>caches.match(e.request)))});
