const CACHE='glowmore-fgms-cloud-build-4-5-1-modular';
const ASSETS=[
  './',
  './index.html',
  './manifest.json',
  './app.css',
  './qc.css',
  './fgms-core.js',
  './inventory.js',
  './production.js',
  './delivery.js',
  './administrator.js',
  './qc.js',
  './session-timeout.js',
  './app.js'
];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate',e=>
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  )
);
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(
    fetch(e.request)
      .then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return r;
      })
      .catch(()=>caches.match(e.request))
  );
});
