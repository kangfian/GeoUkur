const V='geoukur-v1',S=['./','./index.html','./css/style.css','./js/config.js','./js/app.js','./manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(S)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.hostname.includes('script.google')||u.hostname.includes('googleusercontent'))return;
  if(/arcgisonline|openstreetmap/.test(u.hostname))return; // tile peta: biarkan cache bawaan browser
  // stale-while-revalidate: tampil instan dari cache, perbarui di latar belakang
  e.respondWith(caches.open(V).then(c=>c.match(e.request).then(m=>{
    const f=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>m);
    return m||f;
  })));
});
