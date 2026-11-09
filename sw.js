const C = 'safety-v15';
const PRECACHE = [
  './','index.html','seed.js','tb.png','jha.png',
  'img/hero.jpg','img/hardhat.jpg','img/clipboard.jpg','img/tablet.jpg',
  'manifest.json','icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(PRECACHE)).catch(err => console.warn('SW precache failed', err)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.includes('supabase.co') || req.url.includes('/rest/v1/')) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && (req.url.startsWith(self.location.origin) || PRECACHE.some(u => req.url.includes(u.replace('./',''))))) {
        const clone = res.clone();
        caches.open(C).then(c => c.put(req, clone)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./') || caches.match('index.html')))
  );
});
