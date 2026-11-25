(() => {
'use strict';
const C = window.APP_CONFIG || {}, $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf = (n, d = 2) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);
const IC = { x:'M6 6l12 12M18 6L6 18', plus:'M12 5v14M5 12h14', undo:'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', share:'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4', target:'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v4M12 18v4M2 12h4M18 12h4', map:'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14', list:'M4 6h16M4 12h16M4 18h16', layers:'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', sync:'M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5', pin:'M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11zM12 7a3 3 0 100 6 3 3 0 000-6z', down:'M12 4v11M7 11l5 5 5-5M5 20h14', link:'M10 14a4 4 0 005 0l3-3a4 4 0 00-5-5l-1 1M14 10a4 4 0 00-5 0l-3 3a4 4 0 005 5l1-1' };
const ic = n => `<svg class="i" viewBox="0 0 24 24"><path d="${IC[n]}"/></svg>`;
const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };

// ---------- Geodesik (rumus sama dengan turf.area / turf.length) ----------
const R = 6378137, rad = d => d * Math.PI / 180;
const area = p => { const n = p.length; if (n < 3) return 0; let a = 0; for (let i = 0; i < n; i++) a += (rad(p[(i + 2) % n][1]) - rad(p[i][1])) * Math.sin(rad(p[(i + 1) % n][0])); return Math.abs(a * R * R / 2); };
const dist = (a, b) => { const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const perim = p => p.length < 2 ? 0 : p.reduce((s, q, i) => s + (i || p.length > 2 ? dist(p[(i + p.length - 1) % p.length], q) : 0), 0);

// ---------- State & cache (stale-while-revalidate) ----------
const cache = ls('gu_rows') || {};
const S = { rows: cache.rows || [], ver: cache.ver || '', q: ls('gu_q') || [], pts: [], layer: ls('gu_layer') || 'sat', gps: null, last: cache.t || 0, fq: '', fg: '', view: 'peta' };
const okCfg = () => /^https:\/\/script\.google\.com\//.test(C.GAS_URL || '') && !/GANTI|XXXX/.test(C.GAS_URL);
const saveRows = () => ls('gu_rows', { rows: S.rows, ver: S.ver, t: S.last });
const saveQ = () => ls('gu_q', S.q);
const all = () => S.rows.concat(S.q.filter(q => !S.rows.some(r => r.id === q.id)).map(q => ({ ...q, pending: 1 })));
const infl = {};
const get = p => { const u = C.GAS_URL + '?' + new URLSearchParams(p); return infl[u] || (infl[u] = fetch(u).then(r => r.json()).finally(() => delete infl[u])); };
const post = b => fetch(C.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(b) }).then(r => r.json());
let tt; const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 'on'; clearTimeout(tt); tt = setTimeout(() => t.className = '', 2600); };

async function refresh(force) {
  if (!okCfg() || !navigator.onLine) return renderStatus();
  try {
    const r = await get({ action: 'read', v: force ? '' : S.ver });
    if (r.status === 'success') { if (!r.unchanged) { S.rows = r.data; S.ver = r.ver; } S.last = Date.now(); saveRows(); }
  } catch (e) { toast('Tidak terhubung — memakai data tersimpan'); }
  renderAll();
}
let flushing = 0;
async function flush() {
  if (flushing || !okCfg() || !navigator.onLine || !S.q.length) return;
  flushing = 1;
  try { while (S.q.length) { const r = await post({ action: 'create', payload: S.q[0] }); if (r.status !== 'success') { toast('Gagal menyimpan: ' + r.message); if (/wajib|minimal/.test(r.message)) { S.q.shift(); saveQ(); continue; } break; } S.q.shift(); saveQ(); } await refresh(true); } catch (e) {}
  flushing = 0; renderAll();
}

// ---------- Peta ----------
const T = { sat: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }), osm: () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }) };
let map, base, poly, grp, vlayer, readonly = false;
function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: false, tap: true }).setView([3.595, 98.672], 15);
  base = T[S.layer]().addTo(map); grp = L.layerGroup().addTo(map);
  map.on('click', e => { if (readonly) return; S.pts.push([e.latlng.lat, e.latlng.lng]); draw(); });
  map.locate && map.once('locationfound', e => { if (!S.pts.length && !readonly) map.setView(e.latlng, 17); });
}
function setLayer() { S.layer = S.layer === 'sat' ? 'osm' : 'sat'; ls('gu_layer', S.layer); map.removeLayer(base); base = T[S.layer]().addTo(map); base.bringToBack(); }
function metrics(p) { const a = area(p); $('#m2').textContent = nf(a); $('#ha').textContent = nf(a / 1e4, 4); $('#km').textContent = nf(perim(p)); return a; }
function draw() {
  grp.clearLayers(); const p = S.pts;
  poly = L.polygon(p, { color: '#F59E0B', weight: 3, fillColor: '#F59E0B', fillOpacity: .25 }).addTo(grp);
  p.forEach((q, i) => L.marker(q, { draggable: true, icon: L.divIcon({ className: 'vx', iconSize: [36, 36] }) }).addTo(grp)
    .on('drag', e => { const l = e.target.getLatLng(); p[i] = [l.lat, l.lng]; poly.setLatLngs(p); metrics(p); }).on('dragend', draw));
  if (p.length > 1) p.forEach((q, i) => { const n = p[(i + 1) % p.length]; if (p.length < 3 && i) return; L.circleMarker([(q[0] + n[0]) / 2, (q[1] + n[1]) / 2], { radius: 7, weight: 2, color: '#0F172A', fillColor: '#fff', fillOpacity: .85, bubblingMouseEvents: false })
    .addTo(grp).on('click', () => { p.splice(i + 1, 0, [(q[0] + n[0]) / 2, (q[1] + n[1]) / 2]); draw(); }); });
  metrics(p);
}
function view(row) { // mode lihat / tautan bersama
  readonly = true; S.pts = []; grp.clearLayers(); $('#dock').style.display = 'none'; $('.rail').style.display = 'none';
  const p = JSON.parse(row.koordinat_json);
  const pl = L.polygon(p, { color: '#EA580C', weight: 3.5, fillColor: '#EA580C', fillOpacity: .3 }).addTo(grp);
  pl.bindTooltip(`<b>${esc(row.nama_petani)}</b><br>${esc(row.kelompok_tani)} • ${nf(row.luas_ha, 4)} Ha`, { permanent: true, direction: 'center', className: 'lbl' });
  map.fitBounds(pl.getBounds(), { padding: [30, 30], maxZoom: 19 }); metrics(p);
  const c = $('#card'); c.className = 'card on';
  c.innerHTML = `<div class="row"><h3>${esc(row.nama_petani)}</h3><button id="c-x" class="x">${ic('x')}</button></div><div>${esc(row.kelompok_tani)} • ${esc(row.nama_lahan)}</div>
  <div class="grid"><div><small>LUAS</small><b class="mono">${nf(row.luas_m2)} m²</b></div><div><small>HEKTAR</small><b class="mono">${nf(row.luas_ha, 4)} Ha</b></div><div><small>KELILING</small><b class="mono">${nf(row.keliling_m)} m</b></div><div><small>TITIK</small><b class="mono">${row.jumlah_titik}</b></div></div>
  ${row.catatan ? `<div class="box">${esc(row.catatan)}</div>` : ''}
  <div class="acts"><button class="wa" id="c-wa">${ic('share')} WhatsApp</button><button id="c-cp">${ic('link')} Salin</button><button id="c-gj">${ic('down')} GeoJSON</button></div>
  <button class="pri full" id="c-new">Ukur Lahan Baru</button>`;
  $('#c-x').onclick = $('#c-new').onclick = exitView; $('#c-wa').onclick = () => share(row, 'wa'); $('#c-cp').onclick = () => share(row, 'copy'); $('#c-gj').onclick = () => geojson(row);
}
function exitView() { readonly = false; $('#card').className = 'card'; $('#dock').style.display = ''; $('.rail').style.display = ''; history.replaceState(null, '', location.pathname); S.pts = []; draw(); }
const link = r => location.origin + location.pathname + '?id=' + r.id;
function share(r, how) {
  const t = `GeoUkur by Irpan - Data Pengukuran Lahan\nKelompok Tani : ${r.kelompok_tani}\nNama Petani   : ${r.nama_petani}\nBlok Lahan    : ${r.nama_lahan}\nLuas Area     : ${nf(r.luas_m2)} m² (${nf(r.luas_ha, 4)} Ha)\nKeliling      : ${nf(r.keliling_m)} m\n\nTautan Peta Poligon:\n${link(r)}`;
  if (how === 'copy') return (navigator.clipboard ? navigator.clipboard.writeText(link(r)) : Promise.reject()).then(() => toast('Tautan disalin'), () => prompt('Salin tautan:', link(r)));
  if (how === 'native' && navigator.share) return navigator.share({ text: t }).catch(() => {});
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
}
function geojson(r) {
  const c = JSON.parse(r.koordinat_json).map(q => [q[1], q[0]]); c.push(c[0]);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ type: 'Feature', properties: { id: r.id, petani: r.nama_petani, kelompok_tani: r.kelompok_tani, luas_m2: r.luas_m2 }, geometry: { type: 'Polygon', coordinates: [c] } })], { type: 'application/geo+json' }));
  a.download = r.id + '.geojson'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- GPS ----------
let wid = null;
function startGps(cb) {
  if (!navigator.geolocation) return toast('GPS tidak tersedia di perangkat ini');
  if (wid === null) wid = navigator.geolocation.watchPosition(p => { S.gps = { ll: [p.coords.latitude, p.coords.longitude], acc: p.coords.accuracy }; $('#gpsb').textContent = 'GPS ±' + Math.round(p.coords.accuracy) + 'm'; if (S.waiting) { const f = S.waiting; S.waiting = null; f(); } }, () => toast('Izin lokasi ditolak / sinyal GPS lemah'), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  if (S.gps) cb(); else { S.waiting = cb; toast('Mencari sinyal GPS…'); }
}

// ---------- Daftar Poktan ----------
function renderList() {
  const rows = all(), kts = [...new Set(rows.map(r => r.kelompok_tani))].sort();
  const fg = $('#fg'); fg.innerHTML = '<option value="">Semua Poktan</option>' + kts.map(k => `<option ${k === S.fg ? 'selected' : ''}>${esc(k)}</option>`).join('');
  $('#dl-kt').innerHTML = kts.map(k => `<option value="${esc(k)}">`).join('');
  const q = S.fq.toLowerCase(), f = rows.filter(r => (!S.fg || r.kelompok_tani === S.fg) && (!q || (r.nama_petani + ' ' + r.nama_lahan).toLowerCase().includes(q)));
  $('#sum').textContent = `${f.length} Bidang • ${nf(f.reduce((s, r) => s + +r.luas_ha, 0), 4)} Ha`;
  const g = {}; f.forEach(r => (g[r.kelompok_tani] = g[r.kelompok_tani] || []).push(r));
  $('#grp').innerHTML = Object.keys(g).sort().map(k => `<details class="g-h" open><summary><b>${esc(k)}</b><span class="mono">${g[k].length} Bidang • ${nf(g[k].reduce((s, r) => s + +r.luas_ha, 0), 4)} Ha</span></summary>` +
    g[k].map(r => `<div class="it"><div class="t"><div><b>${esc(r.nama_petani)}</b> ${r.pending ? '<span class="tag">MENUNGGU</span>' : ''}<br>${esc(r.nama_lahan)}</div><div class="mono" style="text-align:right"><b>${nf(r.luas_m2)} m²</b><br>${nf(r.luas_ha, 4)} Ha</div></div>
    <div class="a" data-id="${esc(r.id)}"><button data-a="f" aria-label="Fokus peta">${ic('target')}</button><button data-a="s" aria-label="Bagikan">${ic('share')}</button><button class="red" data-a="d" aria-label="Hapus">${ic('trash')}</button></div></div>`).join('') + '</details>').join('') || '<div class="box" style="margin-top:12px">Belum ada data lahan.</div>';
}
$('#grp').onclick = e => {
  const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.parentNode.dataset.id, r = all().find(x => x.id === id); if (!r) return;
  if (b.dataset.a === 'f') { go('peta'); view(r); } else if (b.dataset.a === 's') share(r, navigator.share ? 'native' : 'wa'); else del(r);
};
async function del(r) {
  if (!confirm(`Hapus lahan "${r.nama_lahan}" milik ${r.nama_petani}?`)) return;
  const bakR = S.rows.slice(), bakQ = S.q.slice();
  S.rows = S.rows.filter(x => x.id !== r.id); S.q = S.q.filter(x => x.id !== r.id); saveRows(); saveQ(); renderAll(); // optimistis: langsung hilang
  if (r.pending) return toast('Dihapus');
  try { const x = await post({ action: 'delete', id: r.id }); if (x.status !== 'success') throw new Error(x.message); S.ver = x.ver; saveRows(); toast('Dihapus'); }
  catch (e) { S.rows = bakR; S.q = bakQ; saveRows(); saveQ(); renderAll(); toast('Gagal menghapus: ' + e.message); }
}

// ---------- Simpan ----------
function openSheet() {
  if (S.pts.length < 3) return toast('Tandai minimal 3 titik batas lahan');
  const a = area(S.pts); $('#s-sum').innerHTML = `${nf(a)} m² • ${nf(a / 1e4, 4)} Ha • ${nf(perim(S.pts))} m • ${S.pts.length} titik`; $('#sheet').className = 'sheet on'; $('#f-kt').focus();
}
$('#s-x').onclick = () => $('#sheet').className = 'sheet';
$('#s-ok').onclick = () => {
  const v = id => $(id).value.trim(), kt = v('#f-kt'), np = v('#f-np');
  if (!kt || !np) return toast('Kelompok tani & nama petani wajib diisi');
  const a = area(S.pts), p = { id: 'LHN-' + Date.now(), kelompok_tani: kt, nama_petani: np, nama_lahan: v('#f-nl'), luas_m2: +a.toFixed(2), luas_ha: +(a / 1e4).toFixed(4), keliling_m: +perim(S.pts).toFixed(2), jumlah_titik: S.pts.length, koordinat_json: JSON.stringify(S.pts.map(q => [+q[0].toFixed(7), +q[1].toFixed(7)])), catatan: v('#f-ct') };
  S.q.push(p); saveQ(); S.pts = []; draw(); ['#f-np', '#f-nl', '#f-ct'].forEach(i => $(i).value = ''); $('#sheet').className = 'sheet';
  toast(navigator.onLine && okCfg() ? 'Tersimpan — menyinkronkan…' : 'Disimpan di perangkat, dikirim saat online'); renderAll(); flush();
};

// ---------- Tampilan ----------
function renderStatus() {
  const on = navigator.onLine && okCfg(); $('#dot').className = on ? 'on' : 'off';
  $('#stat').textContent = !okCfg() ? 'Konfigurasi belum lengkap' : on ? 'Online' + (S.q.length ? ` • ${S.q.length} antre` : '') : 'Offline' + (S.q.length ? ` • ${S.q.length} antre` : '');
  $('#sy').innerHTML = `<div class="mono">Status: ${on ? 'ONLINE' : 'OFFLINE'}</div><div class="mono">Data tersimpan: ${all().length} bidang</div><div class="mono">Antrean kirim: ${S.q.length}</div><div class="mono">Sinkron terakhir: ${S.last ? new Date(S.last).toLocaleString('id-ID') : '—'}</div>`;
}
function renderAll() { renderStatus(); renderList(); }
function go(v) {
  S.view = v; document.querySelectorAll('.v').forEach(e => e.classList.toggle('on', e.id === 'v-' + v));
  document.querySelectorAll('nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'peta') setTimeout(() => map.invalidateSize(), 30); if (v === 'persil') renderList();
}

// ---------- Init ----------
function init() {
  const set = (id, h) => $(id).innerHTML = h;
  set('#b-loc', ic('target')); set('#b-undo', ic('undo')); set('#b-reset', ic('trash')); set('#b-pt', ic('plus') + ' TITIK'); set('#b-gps', ic('pin') + ' GPS'); set('#s-x', ic('x')); set('#b-sync', ic('sync') + ' Sinkronkan sekarang');
  const N = document.querySelectorAll('nav button'); N[0].innerHTML = ic('map') + 'PETA'; N[1].innerHTML = ic('list') + 'PERSIL'; N[2].innerHTML = ic('layers') + 'SATELIT'; N[3].innerHTML = ic('sync') + 'SINKRON';
  N.forEach(b => b.onclick = () => b.dataset.v ? go(b.dataset.v) : (setLayer(), toast(S.layer === 'sat' ? 'Citra satelit' : 'Peta jalan')));
  initMap(); draw();
  $('#b-loc').onclick = () => startGps(() => map.setView(S.gps.ll, 19));
  $('#b-undo').onclick = () => { S.pts.pop(); draw(); };
  $('#b-reset').onclick = () => { if (S.pts.length && confirm('Hapus semua titik?')) { S.pts = []; draw(); } };
  $('#b-gps').onclick = () => startGps(() => { S.pts.push(S.gps.ll); draw(); map.setView(S.gps.ll, Math.max(map.getZoom(), 19)); });
  $('#b-pt').onclick = () => { const c = map.getCenter(); S.pts.push([c.lat, c.lng]); draw(); };
  $('#b-save').onclick = openSheet;
  $('#q').oninput = e => { S.fq = e.target.value; renderList(); }; $('#fg').onchange = e => { S.fg = e.target.value; renderList(); };
  $('#b-sync').onclick = () => { flush(); refresh(true); };
  addEventListener('online', () => { flush(); refresh(); }); addEventListener('offline', renderAll);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh());
  renderAll();
  const id = new URLSearchParams(location.search).get('id');
  if (id) { const r = all().find(x => x.id === id); if (r) view(r); get({ action: 'getById', id }).then(x => x.status === 'success' && (!r || S.view === 'peta') && view(x.data[0])).catch(() => !r && toast('Data tidak ditemukan')); }
  if (!id && !S.pts.length) toast('Ketuk peta atau tekan + TITIK (bidik silang) untuk menambah titik');
  refresh().then(flush);
  setInterval(() => document.visibilityState === 'visible' && navigator.onLine && refresh(), 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
init();
})();
