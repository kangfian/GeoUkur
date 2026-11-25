(() => {
'use strict';
const C = window.APP_CONFIG || {}, $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf = (n, d = 2) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);
const IC = { x:'M6 6l12 12M18 6L6 18', plus:'M12 5v14M5 12h14', undo:'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', share:'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4', target:'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v4M12 18v4M2 12h4M18 12h4', map:'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14', list:'M4 6h16M4 12h16M4 18h16', layers:'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', sync:'M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5', pin:'M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11zM12 7a3 3 0 100 6 3 3 0 000-6z', down:'M12 4v11M7 11l5 5 5-5M5 20h14', link:'M10 14a4 4 0 005 0l3-3a4 4 0 00-5-5l-1 1M14 10a4 4 0 00-5 0l-3 3a4 4 0 005 5l1-1', search:'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5', fit:'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' };
const ic = n => `<svg class="i" viewBox="0 0 24 24"><path d="${IC[n]}"/></svg>`;
const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };

// ---------- Geodesik (rumus sama dengan turf.area / turf.length) ----------
const R = 6378137, rad = d => d * Math.PI / 180;
const area = p => { const n = p.length; if (n < 3) return 0; let a = 0; for (let i = 0; i < n; i++) a += (rad(p[(i + 2) % n][1]) - rad(p[i][1])) * Math.sin(rad(p[(i + 1) % n][0])); return Math.abs(a * R * R / 2); };
const dist = (a, b) => { const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const perim = p => p.length < 2 ? 0 : p.reduce((s, q, i) => s + (i || p.length > 2 ? dist(p[(i + p.length - 1) % p.length], q) : 0), 0);

// ---------- State & cache ----------
const cache = ls('gu_rows') || {};
const S = { rows: cache.rows || [], ver: cache.ver || '', q: ls('gu_q') || [], pts: [], layer: ls('gu_layer') || 'sat', gps: null, last: cache.t || 0, fq: '', fg: '', view: 'peta', net: null, err: '' };
const gasUrl = () => ls('gu_url') || C.GAS_URL || '';
const okCfg = () => /^https:\/\/script\.google(usercontent)?\.com\//.test(gasUrl()) && !/GANTI|XXXX/.test(gasUrl());
const saveRows = () => ls('gu_rows', { rows: S.rows, ver: S.ver, t: S.last });
const saveQ = () => ls('gu_q', S.q);
const all = () => S.rows.concat(S.q.filter(q => !S.rows.some(r => r.id === q.id)).map(q => ({ ...q, pending: 1 })));
const errMsg = e => /Failed to fetch|NetworkError|Load failed/i.test(e.message) ? 'Tidak bisa menjangkau server. Periksa URL /exec, sinyal internet, dan Deploy dengan akses "Siapa saja".' : e.message;
async function http(url, opt) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 25000);
  try { const r = await fetch(url, { ...opt, signal: ac.signal }), tx = await r.text();
    try { return JSON.parse(tx); } catch (e) { throw new Error('Server membalas bukan JSON. Pastikan Deploy: jalankan sebagai "Saya", akses "Siapa saja", versi terbaru, dan URL berakhiran /exec.'); }
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'Server tidak merespons (waktu habis)' : errMsg(e)); } finally { clearTimeout(t); }
}
const infl = {};
const get = p => { const u = gasUrl() + '?' + new URLSearchParams(p); return infl[u] || (infl[u] = http(u).finally(() => delete infl[u])); };
const post = b => http(gasUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(b) });
let tt; const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 'on'; clearTimeout(tt); tt = setTimeout(() => t.className = '', 3200); };

async function refresh(force) {
  if (!okCfg()) { renderAll(); return false; }
  try {
    const r = await get({ action: 'read', v: force ? '' : S.ver });
    if (r.status !== 'success') throw new Error(r.message || 'Respons server tidak valid');
    if (!r.unchanged) { S.rows = r.data; S.ver = r.ver; }
    S.last = Date.now(); S.net = true; S.err = ''; saveRows();
  } catch (e) { S.net = false; S.err = e.message; }
  renderAll(); return S.net;
}
let flushing = 0;
async function flush() {
  if (flushing || !okCfg() || !S.q.length) return;
  flushing = 1;
  try {
    while (S.q.length) {
      const r = await post({ action: 'create', payload: S.q[0] });
      if (r.status !== 'success') { if (/wajib|minimal/.test(r.message || '')) { toast('Data ditolak server: ' + r.message); S.q.shift(); saveQ(); continue; } throw new Error(r.message || 'Server menolak'); }
      S.q.shift(); saveQ(); S.net = true; S.err = '';
    }
    await refresh(true);
  } catch (e) { S.net = false; S.err = e.message; toast('Belum tersinkron: ' + e.message); }
  flushing = 0; renderAll();
}

// ---------- Warna per kelompok ----------
const PAL = ['#2563EB', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#0D9488', '#9333EA', '#CA8A04', '#4F46E5', '#BE123C'];
const cm = ls('gu_col') || {};
const colOf = k => { if (!(k in cm)) { const used = new Set(Object.values(cm)); let i = 0; while (used.has(i) && i < PAL.length) i++; cm[k] = i < PAL.length ? i : Object.keys(cm).length % PAL.length; ls('gu_col', cm); } return PAL[cm[k]]; };

// ---------- Peta ----------
const T = { sat: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }), osm: () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }) };
let map, base, poly, grp, sg, hl, tmp, sig = '';
function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: false, tap: true }).setView([3.595, 98.672], 15);
  base = T[S.layer]().addTo(map); sg = L.layerGroup().addTo(map); hl = L.layerGroup().addTo(map); tmp = L.layerGroup().addTo(map); grp = L.layerGroup().addTo(map);
  map.on('click', e => { clearHl(); $('#sr').className = 'sr'; S.pts.push([e.latlng.lat, e.latlng.lng]); draw(); });
  map.on('zoomend', () => $('#map').classList.toggle('nolbl', map.getZoom() < 16)); $('#map').classList.toggle('nolbl', map.getZoom() < 16);
}
function setLayer() { S.layer = S.layer === 'sat' ? 'osm' : 'sat'; ls('gu_layer', S.layer); map.removeLayer(base); base = T[S.layer]().addTo(map); base.bringToBack(); }
function metrics(p) { const a = area(p); $('#m2').textContent = nf(a); $('#ha').textContent = nf(a / 1e4, 4); $('#km').textContent = nf(perim(p)); return a; }
function draw() { // poligon yang sedang diukur (kuning)
  grp.clearLayers(); const p = S.pts;
  poly = L.polygon(p, { color: '#F59E0B', weight: 3, fillColor: '#F59E0B', fillOpacity: .25, interactive: false }).addTo(grp);
  p.forEach((q, i) => L.marker(q, { draggable: true, icon: L.divIcon({ className: 'vx', iconSize: [36, 36] }) }).addTo(grp)
    .on('drag', e => { const l = e.target.getLatLng(); p[i] = [l.lat, l.lng]; poly.setLatLngs(p); metrics(p); }).on('dragend', draw));
  if (p.length > 1) p.forEach((q, i) => { const n = p[(i + 1) % p.length]; if (p.length < 3 && i) return; L.circleMarker([(q[0] + n[0]) / 2, (q[1] + n[1]) / 2], { radius: 7, weight: 2, color: '#0F172A', fillColor: '#fff', fillOpacity: .85, bubblingMouseEvents: false })
    .addTo(grp).on('click', () => { p.splice(i + 1, 0, [(q[0] + n[0]) / 2, (q[1] + n[1]) / 2]); draw(); }); });
  metrics(p);
}
const parse = r => { try { return JSON.parse(r.koordinat_json); } catch (e) { return null; } };
function renderSaved() { // semua lahan tersimpan, warna per kelompok — tampil kembali setiap buka/sinkron
  if (!map) return; const rs = all(), s = rs.map(r => r.id + (r.pending ? 'p' : '')).join();
  if (s === sig) return; sig = s; sg.clearLayers();
  rs.forEach(r => { const p = parse(r); if (!p || p.length < 3) return; const c = colOf(r.kelompok_tani);
    L.polygon(p, { color: c, weight: 3, fillColor: c, fillOpacity: .32, interactive: false }).addTo(sg);
    const m = [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
    L.marker(m, { icon: L.divIcon({ className: 'plab', iconSize: [0, 0], html: `<span style="border-color:${c}">${esc(r.nama_petani)} <small>${nf(r.luas_ha, 2)} Ha</small></span>` }) }).addTo(sg)
      .on('click', ev => { L.DomEvent.stopPropagation(ev); show(r); }); });
}
function fitAll() { const pts = [].concat(...all().map(parse).filter(Boolean)); if (!pts.length) return toast('Belum ada lahan tersimpan'); map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 18 }); }
function clearHl() { hl.clearLayers(); $('#card').className = 'card'; if (location.search) history.replaceState(null, '', location.pathname); }
function show(row) { // lihat lahan tersimpan; pengukuran baru tetap bisa dilakukan
  const p = parse(row); if (!p) return; hl.clearLayers();
  const pl = L.polygon(p, { color: '#090D16', weight: 5, dashArray: '8 6', fill: false, interactive: false }).addTo(hl);
  map.fitBounds(pl.getBounds(), { padding: [40, 40], maxZoom: 19 });
  const c = $('#card'); c.className = 'card on';
  c.innerHTML = `<div class="row"><h3><i class="cd" style="background:${colOf(row.kelompok_tani)}"></i>${esc(row.nama_petani)}</h3><button id="c-x" class="x">${ic('x')}</button></div><div>${esc(row.kelompok_tani)} • ${esc(row.nama_lahan)}</div>
  <div class="grid"><div><small>LUAS</small><b class="mono">${nf(row.luas_m2)} m²</b></div><div><small>HEKTAR</small><b class="mono">${nf(row.luas_ha, 4)} Ha</b></div><div><small>KELILING</small><b class="mono">${nf(row.keliling_m)} m</b></div><div><small>TITIK</small><b class="mono">${row.jumlah_titik}</b></div></div>
  ${row.catatan ? `<div class="box">${esc(row.catatan)}</div>` : ''}
  <div class="acts"><button class="wa" id="c-wa">${ic('share')} WhatsApp</button><button id="c-cp">${ic('link')} Salin</button><button id="c-gj">${ic('down')} GeoJSON</button></div>`;
  $('#c-x').onclick = clearHl; $('#c-wa').onclick = () => share(row, 'wa'); $('#c-cp').onclick = () => share(row, 'copy'); $('#c-gj').onclick = () => geojson(row);
}
const link = r => location.origin + location.pathname + '?id=' + r.id;
function share(r, how) {
  const t = `GeoUkur by Irpan - Data Pengukuran Lahan\nKelompok Tani : ${r.kelompok_tani}\nNama Petani   : ${r.nama_petani}\nBlok Lahan    : ${r.nama_lahan}\nLuas Area     : ${nf(r.luas_m2)} m² (${nf(r.luas_ha, 4)} Ha)\nKeliling      : ${nf(r.keliling_m)} m\n\nTautan Peta Poligon:\n${link(r)}`;
  if (how === 'copy') return (navigator.clipboard ? navigator.clipboard.writeText(link(r)) : Promise.reject()).then(() => toast('Tautan disalin'), () => prompt('Salin tautan:', link(r)));
  if (how === 'native' && navigator.share) return navigator.share({ text: t }).catch(() => {});
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
}
function geojson(r) {
  const c = parse(r).map(q => [q[1], q[0]]); c.push(c[0]);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ type: 'Feature', properties: { id: r.id, petani: r.nama_petani, kelompok_tani: r.kelompok_tani, luas_m2: r.luas_m2 }, geometry: { type: 'Polygon', coordinates: [c] } })], { type: 'application/geo+json' }));
  a.download = r.id + '.geojson'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- Pencarian: koordinat & nama daerah ----------
const LL = /^\s*(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/;
let found = [];
function pin(ll) { tmp.clearLayers(); L.circleMarker(ll, { radius: 11, weight: 3, color: '#000', fillColor: '#EF4444', fillOpacity: .9 }).addTo(tmp); }
async function search() {
  const q = $('#sq').value.trim(), box = $('#sr'); if (!q) return; box.className = 'sr';
  const m = q.match(LL);
  if (m) { const a = +m[1].replace(',', '.'), b = +m[2].replace(',', '.'); if (Math.abs(a) <= 90 && Math.abs(b) <= 180) { map.flyTo([a, b], 18); pin([a, b]); return; } return toast('Koordinat di luar jangkauan (lintang −90…90, bujur −180…180)'); }
  const ql = q.toLowerCase(), loc = all().filter(r => (r.nama_petani + ' ' + r.nama_lahan + ' ' + r.kelompok_tani).toLowerCase().includes(ql)).slice(0, 4).map(r => ({ t: r.nama_petani + ' — ' + r.nama_lahan, s: 'Lahan tersimpan • ' + r.kelompok_tani, row: r }));
  found = loc; renderFound(); toast('Mencari…');
  try {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 12000);
    const j = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=id&accept-language=id&q=' + encodeURIComponent(q), { signal: ac.signal }).then(r => r.json()).finally(() => clearTimeout(to));
    found = loc.concat(j.map(x => ({ t: x.name || x.display_name.split(',')[0], s: x.display_name, ll: [+x.lat, +x.lon], bb: x.boundingbox && x.boundingbox.map(Number) }))); renderFound();
    if (!found.length) toast('Tidak ditemukan. Coba nama desa/kecamatan atau koordinat.');
  } catch (e) { toast(found.length ? 'Pencarian online gagal; hanya hasil lahan tersimpan' : 'Pencarian nama daerah butuh internet'); }
}
function renderFound() { const b = $('#sr'); b.innerHTML = found.map((f, i) => `<button data-i="${i}"><b>${esc(f.t)}</b><small>${esc(f.s)}</small></button>`).join(''); b.className = found.length ? 'sr on' : 'sr'; }
$('#sr').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const f = found[+b.dataset.i]; $('#sr').className = 'sr';
  if (f.row) return show(f.row);
  if (f.bb) map.flyToBounds([[f.bb[0], f.bb[2]], [f.bb[1], f.bb[3]]], { maxZoom: 17 }); else map.flyTo(f.ll, 16); pin(f.ll);
};

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
  $('#grp').innerHTML = Object.keys(g).sort().map(k => `<details class="g-h" open><summary><b><i class="cd" style="background:${colOf(k)}"></i>${esc(k)}</b><span class="mono">${g[k].length} Bidang • ${nf(g[k].reduce((s, r) => s + +r.luas_ha, 0), 4)} Ha</span></summary>` +
    g[k].map(r => `<div class="it"><div class="t"><div><b>${esc(r.nama_petani)}</b> ${r.pending ? '<span class="tag">MENUNGGU</span>' : ''}<br>${esc(r.nama_lahan)}</div><div class="mono" style="text-align:right"><b>${nf(r.luas_m2)} m²</b><br>${nf(r.luas_ha, 4)} Ha</div></div>
    <div class="a" data-id="${esc(r.id)}"><button data-a="f" aria-label="Fokus peta">${ic('target')}</button><button data-a="s" aria-label="Bagikan">${ic('share')}</button><button class="red" data-a="d" aria-label="Hapus">${ic('trash')}</button></div></div>`).join('') + '</details>').join('') || '<div class="box" style="margin-top:12px">Belum ada data lahan.</div>';
}
$('#grp').onclick = e => {
  const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.parentNode.dataset.id, r = all().find(x => x.id === id); if (!r) return;
  if (b.dataset.a === 'f') { go('peta'); setTimeout(() => show(r), 60); } else if (b.dataset.a === 's') share(r, navigator.share ? 'native' : 'wa'); else del(r);
};
async function del(r) {
  if (!confirm(`Hapus lahan "${r.nama_lahan}" milik ${r.nama_petani}?`)) return;
  const bakR = S.rows.slice(), bakQ = S.q.slice();
  S.rows = S.rows.filter(x => x.id !== r.id); S.q = S.q.filter(x => x.id !== r.id); saveRows(); saveQ(); renderAll();
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
  toast(okCfg() ? 'Tersimpan di perangkat — menyinkronkan…' : 'Tersimpan di perangkat. Atur URL server di menu SINKRON agar masuk ke Google Sheets'); renderAll(); flush();
};

// ---------- Tampilan ----------
function renderStatus() {
  const n = S.q.length ? ` • ${S.q.length} antre` : '', ok = okCfg();
  $('#dot').className = !ok ? 'off' : S.net ? 'on' : S.net === false ? 'off' : '';
  $('#stat').textContent = !ok ? 'URL server belum diatur' : S.net ? 'Terhubung' + n : S.net === false ? 'Tidak terhubung' + n : 'Menghubungkan…';
  $('#sy').innerHTML = `<div class="mono">Server: ${!ok ? 'BELUM DIATUR' : S.net ? 'TERHUBUNG' : S.net === false ? 'TIDAK TERHUBUNG' : 'menghubungkan…'}</div><div class="mono">Data di perangkat: ${all().length} bidang</div><div class="mono">Antrean kirim: ${S.q.length}</div><div class="mono">Sinkron terakhir: ${S.last ? new Date(S.last).toLocaleString('id-ID') : '—'}</div>`;
  $('#sy-log').textContent = S.err ? '⚠ ' + S.err : ok ? 'Tidak ada kesalahan.' : 'Tempel URL /exec dari Deploy Apps Script di kolom di atas, lalu tekan "Simpan URL & Uji Koneksi".';
}
function renderAll() { renderStatus(); renderList(); renderSaved(); }
function go(v) {
  S.view = v; document.querySelectorAll('.v').forEach(e => e.classList.toggle('on', e.id === 'v-' + v));
  document.querySelectorAll('nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'peta') setTimeout(() => map.invalidateSize(), 30); if (v === 'persil') renderList();
}

// ---------- Notifikasi pasang aplikasi ----------
let dp = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function showInst() {
  if (standalone() || sessionStorage.getItem('gu_ix')) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); if (!dp && !ios) return;
  $('#inst-t').textContent = dp ? 'Pasang GeoUkur di layar utama agar cepat dibuka & bisa dipakai offline.' : 'Untuk memasang: ketuk ikon Bagikan, lalu "Tambahkan ke Layar Utama".';
  $('#inst-ok').style.display = dp ? '' : 'none'; $('#inst').classList.add('on'); document.body.classList.add('hi');
  document.body.style.setProperty('--ih', ($('#inst').offsetHeight + 8) + 'px'); setTimeout(() => map && map.invalidateSize(), 50);
}
const hideInst = () => { $('#inst').classList.remove('on'); document.body.classList.remove('hi'); setTimeout(() => map && map.invalidateSize(), 50); };
addEventListener('beforeinstallprompt', e => { e.preventDefault(); dp = e; showInst(); });
addEventListener('appinstalled', () => { hideInst(); dp = null; });

// ---------- Init ----------
function init() {
  const set = (id, h) => $(id).innerHTML = h;
  set('#b-loc', ic('target')); set('#b-all', ic('fit')); set('#b-undo', ic('undo')); set('#b-reset', ic('trash')); set('#sb', ic('search')); set('#inst-x', ic('x'));
  set('#b-pt', ic('plus') + ' TITIK'); set('#b-gps', ic('pin') + ' GPS'); set('#s-x', ic('x')); set('#b-sync', ic('sync') + ' Sinkronkan sekarang');
  const N = document.querySelectorAll('nav button'); N[0].innerHTML = ic('map') + 'PETA'; N[1].innerHTML = ic('list') + 'PERSIL'; N[2].innerHTML = ic('layers') + 'SATELIT'; N[3].innerHTML = ic('sync') + 'SINKRON';
  N.forEach(b => b.onclick = () => b.dataset.v ? go(b.dataset.v) : (setLayer(), toast(S.layer === 'sat' ? 'Citra satelit' : 'Peta jalan')));
  initMap(); draw();
  $('#b-loc').onclick = () => startGps(() => map.setView(S.gps.ll, 19));
  $('#b-all').onclick = fitAll;
  $('#b-undo').onclick = () => { S.pts.pop(); draw(); };
  $('#b-reset').onclick = () => { if (S.pts.length && confirm('Hapus semua titik?')) { S.pts = []; draw(); } };
  $('#b-gps').onclick = () => startGps(() => { S.pts.push(S.gps.ll); draw(); map.setView(S.gps.ll, Math.max(map.getZoom(), 19)); });
  $('#b-pt').onclick = () => { const c = map.getCenter(); S.pts.push([c.lat, c.lng]); draw(); };
  $('#b-save').onclick = openSheet;
  $('#sb').onclick = search; $('#sq').onkeydown = e => e.key === 'Enter' && search();
  $('#q').oninput = e => { S.fq = e.target.value; renderList(); }; $('#fg').onchange = e => { S.fg = e.target.value; renderList(); };
  $('#b-sync').onclick = async () => { toast('Menyinkronkan…'); await flush(); const ok = await refresh(true); if (ok) { go('peta'); setTimeout(fitAll, 80); toast('Tersinkron: ' + all().length + ' lahan ditampilkan'); } else toast('Gagal: ' + S.err); };
  $('#b-test').onclick = async () => {
    const u = $('#f-url').value.trim(); if (u) ls('gu_url', u);
    if (!okCfg()) return toast('URL harus diawali https://script.google.com/ dan berakhiran /exec');
    const t0 = Date.now(); try { const r = await get({ action: 'ping' }); if (r.status !== 'success') throw new Error(r.message || 'Respons tidak valid'); toast('Terhubung ✓ (' + (Date.now() - t0) + ' ms)'); await flush(); await refresh(true); } catch (e) { S.net = false; S.err = e.message; renderAll(); toast('Gagal terhubung'); }
  };
  $('#f-url').value = okCfg() ? gasUrl() : '';
  $('#inst-ok').onclick = async () => { if (!dp) return; dp.prompt(); await dp.userChoice; dp = null; hideInst(); };
  $('#inst-x').onclick = () => { sessionStorage.setItem('gu_ix', 1); hideInst(); };
  addEventListener('online', () => { flush(); refresh(); });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && (flush(), refresh()));
  renderAll(); showInst();
  const id = new URLSearchParams(location.search).get('id');
  if (id) { const r = all().find(x => x.id === id); if (r) show(r); if (okCfg()) get({ action: 'getById', id }).then(x => x.status === 'success' && !r && show(x.data[0])).catch(() => !r && toast('Data tidak ditemukan')); }
  else if (all().length) fitAll(); else if (!okCfg()) toast('Atur URL server di menu SINKRON agar data tersimpan ke Google Sheets');
  else toast('Ketuk peta atau tekan + TITIK (bidik silang) untuk menambah titik');
  refresh().then(flush);
  setInterval(() => document.visibilityState === 'visible' && (flush(), refresh()), 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
init();
})();
