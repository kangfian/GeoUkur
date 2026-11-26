const V='geoukur-v2',S=['./','./index.html','./css/style.css','./js/config.js','./js/app.js','./manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(S)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim()});
const keep=(r)=>{if(r.ok){const c=r.clone();caches.open(V).then(x=>x.put(r.url,c))}return r};
self.addEventListener('fetch',e=>{
  const q=e.request,u=new URL(q.url);
  if(q.method!=='GET'||/script\.google|googleusercontent|arcgisonline|openstreetmap|nominatim/.test(u.hostname))return;
  if(u.origin===location.origin){ // aplikasi sendiri: jaringan dulu (selalu versi terbaru, termasuk config.js), cadangan cache bila offline
    e.respondWith(Promise.race([fetch(q).then(keep),new Promise((_,j)=>setTimeout(j,4000))]).catch(()=>caches.match(q,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
  }else{ // pustaka CDN: cache dulu, perbarui di latar belakang
    e.respondWith(caches.match(q).then(m=>m||fetch(q).then(keep)));
  }
});
