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


// Tumpang tindih (sama dengan server): bersinggungan boleh, saling menimpa tidak.
function tumpang(A, B) {
  const la = A[0][0], lo = A[0][1], kx = Math.cos(rad(la)) * 111320, ky = 110540, E = 0.1;
  const f = p => [(p[1] - lo) * kx, (p[0] - la) * ky], a = A.map(f), b = B.map(f);
  const bb = q => { const x = q.map(v => v[0]), y = q.map(v => v[1]); return [Math.min(...x), Math.max(...x), Math.min(...y), Math.max(...y)]; };
  const u = bb(a), w = bb(b); if (u[1] < w[0] || w[1] < u[0] || u[3] < w[2] || w[3] < u[2]) return false;
  const sd = (p, q, r) => ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1e-9);
  const segD = (p, q, r) => { const dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy || 1e-9; let t = ((r[0] - p[0]) * dx + (r[1] - p[1]) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(r[0] - p[0] - t * dx, r[1] - p[1] - t * dy); };
  const inside = (r, q) => { for (let i = 0; i < q.length; i++) if (segD(q[i], q[(i + 1) % q.length], r) < E) return false; let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i][1] > r[1]) !== (q[j][1] > r[1]) && r[0] < (q[j][0] - q[i][0]) * (r[1] - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) c = !c; return c; };
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length], p3 = b[j], p4 = b[(j + 1) % b.length], d1 = sd(p3, p4, p1), d2 = sd(p3, p4, p2), d3 = sd(p1, p2, p3), d4 = sd(p1, p2, p4);
    if (((d1 > E && d2 < -E) || (d1 < -E && d2 > E)) && ((d3 > E && d4 < -E) || (d3 < -E && d4 > E))) return true;
  }
  if (a.some(v => inside(v, b)) || b.some(v => inside(v, a))) return true;
  const cen = q => [q.reduce((s, v) => s + v[0], 0) / q.length, q.reduce((s, v) => s + v[1], 0) / q.length];
  const samp = q => { const c = cen(q), o = [c]; q.forEach(v => [.1, .3, .5].forEach(t => o.push([v[0] + (c[0] - v[0]) * t, v[1] + (c[1] - v[1]) * t]))); return o; };
  return samp(a).concat(samp(b)).some(s => inside(s, a) && inside(s, b));
}

// ---------- State & cache ----------
const cache = ls('gu_rows') || {};
const S = { rows: cache.rows || [], ver: cache.ver || '', q: ls('gu_q') || [], pts: [], layer: ls('gu_layer') || 'sat', gps: null, last: cache.t || 0, fq: '', fg: '', view: 'peta', net: null, err: '', rej: ls('gu_rej') || [], draw: false, op: new Set(), cl: new Set(), pl: [], sel: -1 };
const gasUrl = () => C.GAS_URL || '';
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
      if (r.status !== 'success') { if (/wajib|minimal|tumpang tindih|tidak valid/.test(r.message || '')) { S.rej.push({ nama: S.q[0].nama_petani, alasan: r.message }); ls('gu_rej', S.rej); toast('Ditolak server: ' + r.message); S.q.shift(); saveQ(); continue; } throw new Error(r.message || 'Server menolak'); }
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
let nat = +ls('gu_nat') || 18; // zoom tertinggi yang citra aslinya ada; di atasnya tile diperbesar, bukan kosong
const T = { sat: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: nat }), osm: () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 21, maxNativeZoom: 19 }) };
let map, base, poly, cas, grp, lg, sg, hl, tmp, sig = '', ptm;
function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: false, tap: true, maxZoom: 21 }).setView([3.595, 98.672], 15);
  base = T[S.layer]().addTo(map); sg = L.layerGroup().addTo(map); hl = L.layerGroup().addTo(map); tmp = L.layerGroup().addTo(map); grp = L.layerGroup().addTo(map); lg = L.layerGroup().addTo(map);
  map.on('click', e => { tmp.clearLayers(); $('#sr').className = 'sr'; if (!S.draw) { const h = polyAt(e.latlng.lat, e.latlng.lng); if (h) show(h, false); else clearHl(); return; } clearHl(); S.pts.push([e.latlng.lat, e.latlng.lng]); S.sel = -1; draw(); });
  map.on('moveend', () => { clearTimeout(ptm); ptm = setTimeout(probe, 700); });
  map.on('zoomend', () => $('#map').classList.toggle('nolbl', map.getZoom() < 16)); $('#map').classList.toggle('nolbl', map.getZoom() < 16);
}
function setLayer() { S.layer = S.layer === 'sat' ? 'osm' : 'sat'; ls('gu_layer', S.layer); map.removeLayer(base); base = T[S.layer]().addTo(map); base.bringToBack(); if (S.layer === 'sat') setTimeout(probe, 400); }
// Tile 'Map data not yet available' = gambar abu-abu rata (tanpa tekstur & tanpa warna). Dideteksi lewat piksel, lalu zoom asli diturunkan.
function kosong(im) {
  const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 48, 48); const d = g.getImageData(0, 0, 48, 48).data;
  let n = 0, s = 0, s2 = 0, sat = 0; for (let i = 0; i < d.length; i += 4) { const l = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; s += l; s2 += l * l; sat += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); n++; }
  const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)) < 12 && sat / n < 10;
}
function probe() {
  if (!map || S.layer !== 'sat') return; const z = map.getZoom(); if (z < 15 || z > 19) return;
  const c = map.getCenter(), n = 2 ** z, x = Math.floor((c.lng + 180) / 360 * n), la = rad(c.lat), y = Math.floor((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n);
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => { let k; try { k = kosong(im); } catch (e) { return; }
    let nn = nat; if (k && z <= nat) nn = Math.max(13, z - 1); else if (!k && z > nat) nn = Math.min(19, z); if (nn === nat) return;
    nat = nn; ls('gu_nat', nat); base.options.maxNativeZoom = nat; base.redraw(); if (k) toast('Citra satelit paling detail di area ini sampai zoom ' + nat); };
  im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}
function setDraw(on) { // mulai / akhiri pembuatan polygon baru
  S.draw = on; document.body.classList.toggle('drawing', on); $('#b-new').style.display = on ? 'none' : ''; $('#dk2').hidden = !on;
  if (on) { clearHl(); tmp.clearLayers(); toast('Ketuk peta atau tekan + TITIK BARU. Untuk menggeser, ketuk titik: pin merah muncul di bawahnya, geser lewat pin itu agar jari tidak menutupi titik'); } else { S.pts = []; S.sel = -1; draw(); }
  setTimeout(() => map && map.invalidateSize(), 50);
}
function metrics(p) { const a = area(p); $('#m2').textContent = nf(a); $('#ha').textContent = nf(a / 1e4, 4); $('#km').textContent = nf(a / 400); return a; }
const fm = m => m >= 1000 ? nf(m / 1000, 2) + ' km' : nf(m, m < 100 ? 1 : 0) + ' m';
function segLabels() { // jarak tiap sisi, diputar mengikuti garis
  lg.clearLayers(); const p = S.pts, n = p.length; let tot = 0;
  if (n >= 2) for (let i = 0; i < (n === 2 ? 1 : n); i++) {
    const a = p[i], b = p[(i + 1) % n], d = dist(a, b), A = map.latLngToContainerPoint(a), B = map.latLngToContainerPoint(b); tot += d;
    let g = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI; if (g > 90) g -= 180; if (g <= -90) g += 180;
    L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { interactive: false, icon: L.divIcon({ className: 'seg', iconSize: [0, 0], html: `<span style="transform:translate(-50%,-50%) rotate(${g.toFixed(1)}deg) translateY(-17px)">${fm(d)}</span>` }) }).addTo(lg);
  }
  const j = $('#jar'); if (j) { j.hidden = !(S.draw && n >= 2); j.textContent = 'Jarak: ' + nf(tot, 1) + ' m'; }
}
function draw() { // polygon yang sedang dibuat: garis hijau + jarak tiap sisi
  grp.clearLayers(); const p = S.pts, ring = () => p.length > 2 ? p.concat([p[0]]) : p;
  cas = L.polyline(ring(), { color: '#0F172A', weight: 8, opacity: .55, interactive: false }).addTo(grp);
  poly = (p.length > 2 ? L.polygon(p, { color: '#22C55E', weight: 4, fillColor: '#22C55E', fillOpacity: .2, interactive: false }) : L.polyline(p, { color: '#22C55E', weight: 4, interactive: false })).addTo(grp);
  p.forEach((q, i) => { const m = L.marker(q, { draggable: true, icon: L.divIcon({ className: 'vx' + (i === S.sel ? ' sel' : ''), iconSize: [36, 36] }) }).addTo(grp), el = m.getElement && m.getElement(); let was = false;
    // begitu titik ditekan: pin merah langsung muncul DI BAWAH titik (ujung runcing di titik) sebagai pegangan geser
    if (el) el.addEventListener('pointerdown', () => { was = S.sel === i; S.sel = i; document.querySelectorAll('.vx.sel').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); });
    m.on('click', () => { if (was) S.sel = -1; draw(); });
    m.on('dragstart', () => { was = false; S.sel = i; });
    m.on('drag', e => { const l = e.target.getLatLng(); p[i] = [l.lat, l.lng]; poly.setLatLngs(p); cas.setLatLngs(ring()); metrics(p); segLabels(); }).on('dragend', draw); });
  if (p.length > 1) p.forEach((q, i) => { const n = p[(i + 1) % p.length]; if (p.length < 3 && i) return; L.circleMarker([(q[0] + n[0]) / 2, (q[1] + n[1]) / 2], { radius: 9, weight: 3, color: '#0F172A', fillColor: '#fff', fillOpacity: 1, bubblingMouseEvents: false })
    .addTo(grp).on('click', () => { p.splice(i + 1, 0, [(q[0] + n[0]) / 2, (q[1] + n[1]) / 2]); S.sel = -1; draw(); }); });
  metrics(p); segLabels();
}
const parse = r => { try { return JSON.parse(r.koordinat_json); } catch (e) { return null; } };
function renderSaved() { // semua lahan tersimpan, warna per kelompok — tampil kembali setiap buka/sinkron
  if (!map) return; const rs = all(), s = rs.map(r => r.id + (r.pending ? 'p' : '')).join();
  if (s === sig) return; sig = s; sg.clearLayers(); S.pl = [];
  rs.forEach(r => { const p = parse(r); if (!p || p.length < 3) return; const c = colOf(r.kelompok_tani);
    S.pl.push({ r, p, b: [Math.min(...p.map(q => q[0])), Math.max(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[1]))] });
    L.polygon(p, { color: c, weight: 3, fillColor: c, fillOpacity: .32, interactive: false }).addTo(sg);
    const m = [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
    L.marker(m, { icon: L.divIcon({ className: 'plab', iconSize: [0, 0], html: `<span style="border-color:${c}">${esc(r.nama_petani)} <small>${nf(r.luas_ha, 2)} Ha</small></span>` }) }).addTo(sg)
      .on('click', ev => { L.DomEvent.stopPropagation(ev); show(r, false); }); });
}
function polyAt(la, lo) { // lahan tersimpan yang berisi titik yang diketuk
  const inP = p => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][0] > la) !== (p[j][0] > la) && lo < (p[j][1] - p[i][1]) * (la - p[i][0]) / (p[j][0] - p[i][0]) + p[i][1]) c = !c; return c; };
  const h = S.pl.find(x => la >= x.b[0] && la <= x.b[1] && lo >= x.b[2] && lo <= x.b[3] && inP(x.p)); return h && h.r;
}
function fitAll() { const pts = [].concat(...all().map(parse).filter(Boolean)); if (!pts.length) return toast('Belum ada lahan tersimpan'); map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 18 }); }
function clearHl() { hl.clearLayers(); $('#card').className = 'card'; if (location.search) history.replaceState(null, '', location.pathname); }
function show(row, fit = true) { // lihat lahan tersimpan; pengukuran baru tetap bisa dilakukan
  const p = parse(row); if (!p) return; hl.clearLayers();
  const pl = L.polygon(p, { color: '#090D16', weight: 5, dashArray: '8 6', fill: false, interactive: false }).addTo(hl);
  if (fit) map.fitBounds(pl.getBounds(), { padding: [40, 40], maxZoom: 19 });
  const sm = all().filter(x => petKey(x) === petKey(row)), c = $('#card'); c.className = 'card on';
  c.innerHTML = `<div class="row"><h3><i class="cd" style="background:${colOf(row.kelompok_tani)}"></i>${esc(row.nama_petani)}</h3><button id="c-x" class="x">${ic('x')}</button></div><div>${esc(row.kelompok_tani)} • ${esc(row.nama_lahan)}</div>
  <div class="grid"><div><small>LUAS</small><b class="mono">${nf(row.luas_m2)} m²</b></div><div><small>HEKTAR (Ha)</small><b class="mono">${nf(row.luas_ha, 4)}</b></div><div><small>RANTE</small><b class="mono">${nf(row.luas_m2 / 400)}</b></div><div><small>TITIK</small><b class="mono">${row.jumlah_titik}</b></div></div>
  ${row.catatan ? `<div class="box">${esc(row.catatan)}</div>` : ''}
  ${sm.length > 1 ? `<div class="box note">Petani ini memiliki <b>${sm.length} lahan</b> • total <b>${nf(m2s(sm) / 1e4, 4)} Ha</b> (${nf(m2s(sm) / 400)} rante)<button class="sec full" id="c-all" style="margin-top:8px;min-height:44px">Lihat semua lahan petani</button></div>` : ''}
  <div class="acts"><button class="wa" id="c-wa">${ic('share')} WhatsApp</button><button class="pri" id="c-fmt">${ic('down')} Bagikan / Unduh</button></div>`;
  if (sm.length > 1) $('#c-all').onclick = () => showPetani(sm);
  $('#c-x').onclick = clearHl; $('#c-wa').onclick = () => share(row, 'wa'); $('#c-fmt').onclick = () => openFmt([row], `${row.nama_lahan || '(tanpa nama)'} — ${String(row.nama_petani).trim()}`);
}
const ctrOf = r => { const p = parse(r); return p && p.length ? [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length] : null; };
const c6 = c => c ? c[0].toFixed(6) + ', ' + c[1].toFixed(6) : '-';
const gm = c => c ? `https://maps.google.com/?q=${c[0].toFixed(6)},${c[1].toFixed(6)}` : '';
const link = r => location.origin + location.pathname + '?id=' + r.id;
function share(r, how) {
  const t = `GeoUkur by Irpan - Data Pengukuran Lahan\nKelompok Tani : ${r.kelompok_tani}\nNama Petani   : ${r.nama_petani}\nBlok Lahan    : ${r.nama_lahan}\nLuas Area     : ${nf(r.luas_m2)} m² (${nf(r.luas_ha, 4)} Ha)\nRante         : ${nf(r.luas_m2 / 400)} rante (1 rante = 400 m²)\nTitik Pusat   : ${c6(ctrOf(r))}\nGoogle Maps   : ${gm(ctrOf(r))}\n\nTautan Peta Poligon:\n${link(r)}`;
  if (how === 'copy') return (navigator.clipboard ? navigator.clipboard.writeText(link(r)) : Promise.reject()).then(() => toast('Tautan disalin'), () => prompt('Salin tautan:', link(r)));
  if (how === 'native' && navigator.share) return navigator.share({ text: t }).catch(() => {});
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
}

// ---------- Pencarian: koordinat & nama daerah ----------
const LL = /^\s*(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/;
let found = [];
function pin(ll) { tmp.clearLayers(); L.circleMarker(ll, { radius: 11, weight: 3, color: '#000', fillColor: '#EF4444', fillOpacity: .9 }).addTo(tmp); }
async function search() {
  const q = $('#sq').value.trim(), box = $('#sr'); if (!q) return; box.className = 'sr';
  const m = q.match(LL);
  if (m) { const a = +m[1].replace(',', '.'), b = +m[2].replace(',', '.'); if (Math.abs(a) <= 90 && Math.abs(b) <= 180) { map.flyTo([a, b], 18); pin([a, b]); $('.srch').classList.remove('on'); return; } return toast('Koordinat di luar jangkauan (lintang −90…90, bujur −180…180)'); }
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
  const b = e.target.closest('button'); if (!b) return; const f = found[+b.dataset.i]; $('#sr').className = 'sr'; $('.srch').classList.remove('on');
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

// ---------- Daftar: Poktan → Petani (lahan digabung) → Lahan ----------
const nk = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase(), petKey = r => nk(r.kelompok_tani) + '|' + nk(r.nama_petani);
const m2s = l => l.reduce((s, r) => s + +r.luas_m2, 0);
const tot = m => `${nf(m)} m²`, totSub = m => `${nf(m / 1e4, 4)} Ha • ${nf(m / 400)} rante`;
function fillNp() { const k = nk($('#f-kt').value); $('#dl-np').innerHTML = [...new Set(all().filter(r => nk(r.kelompok_tani) === k).map(r => String(r.nama_petani).trim()))].sort().map(n => `<option value="${esc(n)}">`).join(''); }
function renderList() {
  const rows = all(), kts = [...new Set(rows.map(r => r.kelompok_tani))].sort();
  const fg = $('#fg'); fg.innerHTML = '<option value="">Semua Poktan</option>' + kts.map(k => `<option ${k === S.fg ? 'selected' : ''}>${esc(k)}</option>`).join('');
  $('#dl-kt').innerHTML = kts.map(k => `<option value="${esc(k)}">`).join('');
  const q = S.fq.toLowerCase(), f = rows.filter(r => (!S.fg || r.kelompok_tani === S.fg) && (!q || (r.nama_petani + ' ' + r.nama_lahan).toLowerCase().includes(q)));
  $('#sum').textContent = `${new Set(f.map(petKey)).size} Petani • ${f.length} Lahan • ${nf(m2s(f) / 1e4, 4)} Ha • ${nf(m2s(f) / 400)} Rante`;
  const g = {}; f.forEach(r => (g[r.kelompok_tani] = g[r.kelompok_tani] || []).push(r));
  $('#grp').innerHTML = Object.keys(g).sort().map(k => {
    const pm = {}; g[k].forEach(r => (pm[petKey(r)] = pm[petKey(r)] || []).push(r));
    const keys = Object.keys(pm).sort((x, y) => nk(pm[x][0].nama_petani) < nk(pm[y][0].nama_petani) ? -1 : 1);
    return `<details class="g-h" data-k="k:${esc(k)}" ${S.cl.has('k:' + k) ? '' : 'open'}><summary><b><i class="cd" style="background:${colOf(k)}"></i>${esc(k)}</b><span class="mono">${keys.length} Petani • ${g[k].length} Lahan • ${nf(m2s(g[k]) / 1e4, 4)} Ha</span></summary>` +
    keys.map(pk => { const L2 = pm[pk], m = m2s(L2);
      return `<details class="pt" data-k="${esc(pk)}" ${S.op.has(pk) ? 'open' : ''}><summary><div><b>${esc(String(L2[0].nama_petani).trim())}</b><br><span class="tag2">${L2.length} lahan</span></div><div class="mono" style="text-align:right"><b>${tot(m)}</b><br>${totSub(m)}</div></summary>
      <div class="a" data-k="${esc(pk)}"><button data-a="pf" aria-label="Lihat semua lahan petani">${ic('target')} Semua</button><button data-a="ps" aria-label="Bagikan rekap petani">${ic('share')} Rekap</button></div>` +
      L2.map(r => `<div class="it"><div class="t"><div>${esc(r.nama_lahan) || '(tanpa nama)'} ${r.pending ? '<span class="tag">MENUNGGU</span>' : ''}</div><div class="mono" style="text-align:right"><b>${tot(r.luas_m2)}</b><br>${totSub(r.luas_m2)}</div></div>
      <div class="a" data-id="${esc(r.id)}"><button data-a="f" aria-label="Fokus peta">${ic('target')}</button><button data-a="s" aria-label="Bagikan">${ic('share')}</button>${r.pending ? `<button class="red" data-a="d" aria-label="Hapus">${ic('trash')}</button>` : ''}</div></div>`).join('') + '</details>'; }).join('') + '</details>';
  }).join('') || '<div class="empty"><svg viewBox="0 0 24 24"><path d="M4.5 8.5L10 4l9.5 4.5-1.5 10L7 20z"/></svg><b>Belum ada lahan</b><span>Buka tab PETA, tekan "Buat Polygon Baru", lalu tandai batas lahan.</span></div>';
}
$('#grp').addEventListener('toggle', e => { const d = e.target, k = d.dataset && d.dataset.k; if (!k) return; if (k.startsWith('k:')) d.open ? S.cl.delete(k) : S.cl.add(k); else d.open ? S.op.add(k) : S.op.delete(k); }, true);
$('#grp').onclick = e => {
  const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a;
  if (a === 'pf' || a === 'ps') { const L2 = all().filter(r => petKey(r) === b.parentNode.dataset.k); if (!L2.length) return; if (a === 'pf') { go('peta'); setTimeout(() => showPetani(L2), 60); } else openFmt(L2, `${String(L2[0].nama_petani).trim()} (rekap ${L2.length} lahan)`); return; }
  const r = all().find(x => x.id === b.parentNode.dataset.id); if (!r) return;
  if (a === 'f') { go('peta'); setTimeout(() => show(r), 60); } else if (a === 's') openFmt([r], `${r.nama_lahan || '(tanpa nama)'} — ${String(r.nama_petani).trim()}`); else del(r);
};
function showPetani(L2) { // semua lahan satu petani sebagai satu kesatuan
  hl.clearLayers(); const pts = [];
  L2.forEach(r => { const p = parse(r); if (!p) return; pts.push(...p); L.polygon(p, { color: '#090D16', weight: 5, dashArray: '8 6', fill: false, interactive: false }).addTo(hl); });
  if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 19 });
  const m = m2s(L2), c = $('#card'); c.className = 'card on';
  c.innerHTML = `<div class="row"><h3><i class="cd" style="background:${colOf(L2[0].kelompok_tani)}"></i>${esc(String(L2[0].nama_petani).trim())}</h3><button id="c-x" class="x">${ic('x')}</button></div><div>${esc(L2[0].kelompok_tani)} • ${L2.length} lahan</div>
  <div class="grid"><div><small>TOTAL LUAS</small><b class="mono">${tot(m)}</b></div><div><small>TOTAL (Ha)</small><b class="mono">${nf(m / 1e4, 4)}</b></div><div><small>TOTAL RANTE</small><b class="mono">${nf(m / 400)}</b></div><div><small>JUMLAH LAHAN</small><b class="mono">${L2.length}</b></div></div>
  <div class="box">${L2.map(r => `${esc(r.nama_lahan) || '(tanpa nama)'} — ${nf(r.luas_ha, 4)} Ha`).join('<br>')}</div>
  <div class="acts"><button class="pri" id="c-fmt">${ic('down')} Bagikan / Unduh rekap</button></div>`;
  $('#c-x').onclick = clearHl; $('#c-fmt').onclick = () => openFmt(L2, `${String(L2[0].nama_petani).trim()} (rekap ${L2.length} lahan)`);
}
// ---------- Bagikan / Unduh (pilih format) ----------
let fmtRows = [];
function openFmt(rows, judul) { fmtRows = rows; $('#fmt-t').textContent = judul; document.body.classList.add('sh'); $('#fmt').className = 'sheet on'; }
const closeFmt = () => { $('#fmt').className = 'sheet'; document.body.classList.remove('sh'); };
async function deliver(o) { // di HP: lembar bagikan sistem; di komputer: unduh
  const file = new File([o.blob], o.name, { type: o.mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: o.name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(o.blob); a.download = o.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); toast('File diunduh: ' + o.name);
}
$('#fmt').addEventListener('click', async e => {
  const b = e.target.closest('button[data-f]'); if (!b || !fmtRows.length) return; const f = b.dataset.f, rows = fmtRows;
  if (f === 'wa') { closeFmt(); return rows.length === 1 ? share(rows[0], 'wa') : sharePetani(rows); }
  if (f === 'link') { closeFmt(); const t = rows.length === 1 ? link(rows[0]) : rows.map(r => `${r.nama_lahan || '(tanpa nama)'}: ${link(r)}`).join('\n'); return (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Tautan web disalin'), () => prompt('Salin tautan:', t)); }
  b.disabled = true; toast(f === 'pdf' || f === 'png' ? 'Membuat file & mengambil citra satelit…' : 'Membuat file…');
  try { const o = await GeoExport.make(f, rows, { colorOf: r => colOf(r.kelompok_tani), link, nat }); closeFmt(); await deliver(o); } catch (er) { toast('Gagal membuat file: ' + er.message); }
  b.disabled = false;
});
function sharePetani(L2) {
  const m = m2s(L2), t = `GeoUkur by Irpan - Rekap Lahan Petani\nKelompok Tani : ${L2[0].kelompok_tani}\nNama Petani   : ${String(L2[0].nama_petani).trim()}\nJumlah Lahan  : ${L2.length} lahan\nTotal Luas    : ${nf(m)} m² (${nf(m / 1e4, 4)} Ha • ${nf(m / 400)} rante)\n\nRincian:\n` + L2.map((r, i) => `${i + 1}. ${r.nama_lahan || '(tanpa nama)'} — ${nf(r.luas_m2)} m² (${nf(r.luas_ha, 4)} Ha)\n   Titik pusat: ${c6(ctrOf(r))}\n   ${link(r)}`).join('\n');
  if (navigator.share) return navigator.share({ text: t }).catch(() => {});
  window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
}
function del(r) { // hanya untuk data yang belum terkirim; data di server dihapus lewat halaman admin
  if (!r.pending || !confirm(`Hapus lahan "${r.nama_lahan}" milik ${r.nama_petani} dari antrean?`)) return;
  S.q = S.q.filter(x => x.id !== r.id); saveQ(); renderAll(); toast('Dihapus');
}

// ---------- Simpan ----------
function openSheet() {
  if (S.pts.length < 3) return toast('Tandai minimal 3 titik batas lahan');
  const t = all().find(r => { const q = parse(r); return q && q.length > 2 && tumpang(S.pts, q); });
  if (t) { show(t); return toast(`Tumpang tindih dengan lahan "${t.nama_lahan}" milik ${t.nama_petani}. Geser titik agar tidak menimpa lahan yang sudah terpolygon.`); }
  const a = area(S.pts); $('#s-sum').innerHTML = `<div><small>LUAS</small><b class="mono">${nf(a)} m²</b></div><div><small>HEKTAR</small><b class="mono">${nf(a / 1e4, 4)}</b></div><div><small>RANTE</small><b class="mono">${nf(a / 400)}</b></div>`; document.body.classList.add('sh'); $('#sheet').className = 'sheet on'; fillNp(); $('#f-kt').focus();
}
const closeSheet = () => { $('#sheet').className = 'sheet'; document.body.classList.remove('sh'); };
$('#s-x').onclick = closeSheet;
$('#s-ok').onclick = () => {
  const v = id => $(id).value.trim(), kt = v('#f-kt'), np = v('#f-np');
  if (!kt || !np) return toast('Kelompok tani & nama petani wajib diisi');
  const a = area(S.pts), p = { id: 'LHN-' + Date.now(), kelompok_tani: kt, nama_petani: np, nama_lahan: v('#f-nl'), luas_m2: +a.toFixed(2), luas_ha: +(a / 1e4).toFixed(4), keliling_m: +perim(S.pts).toFixed(2), jumlah_titik: S.pts.length, koordinat_json: JSON.stringify(S.pts.map(q => [+q[0].toFixed(7), +q[1].toFixed(7)])), catatan: v('#f-ct') };
  S.q.push(p); saveQ(); setDraw(false); ['#f-np', '#f-nl', '#f-ct'].forEach(i => $(i).value = ''); closeSheet();
  toast(okCfg() ? 'Tersimpan di perangkat — menyinkronkan…' : 'Tersimpan di perangkat. Isi GAS_URL di js/config.js agar masuk ke Google Sheets'); renderAll(); flush();
};

// ---------- Tampilan ----------
function renderStatus() {
  const n = S.q.length ? ` • ${S.q.length} antre` : '', ok = okCfg();
  $('#dot').className = !ok ? 'off' : S.net ? 'on' : S.net === false ? 'off' : '';
  $('#stat').textContent = !ok ? 'URL server belum diatur' : S.net ? 'Terhubung' + n : S.net === false ? 'Tidak terhubung' + n : 'Menghubungkan…';
  const pl = (t, c) => `<span class="pill ${c}">${t}</span>`;
  $('#sy').innerHTML = `<div class="kv"><span>Server</span>${!ok ? pl('BELUM DIATUR', 'bad') : S.net ? pl('TERHUBUNG', 'ok') : S.net === false ? pl('TIDAK TERHUBUNG', 'bad') : pl('MENGHUBUNGKAN', '')}</div><div class="kv"><span>Data di perangkat</span><b>${all().length} lahan</b></div><div class="kv"><span>Antrean kirim</span><b>${S.q.length}</b></div><div class="kv"><span>Sinkron terakhir</span><b>${S.last ? new Date(S.last).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</b></div>`;
  $('#sy-log').textContent = S.rej.length ? '⛔ Ditolak server: ' + S.rej.map(r => r.nama + ' — ' + r.alasan).join(' | ') : S.err ? '⚠ ' + S.err : ok ? 'Tidak ada kesalahan.' : 'URL server belum diisi. Isi GAS_URL di berkas js/config.js lalu unggah ulang ke GitHub.';
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
  set('#b-loc', ic('target')); set('#b-all', ic('fit')); set('#b-undo', ic('undo')); set('#b-reset', ic('trash')); set('#sb', ic('search')); set('#b-sr', ic('search')); set('#sx', ic('x')); set('#inst-x', ic('x'));
  set('#b-new', ic('plus') + ' Buat Polygon Baru'); set('#b-pt', ic('plus') + ' TITIK BARU'); set('#b-gps', ic('pin') + ' GPS'); set('#s-x', ic('x')); set('#f-x', ic('x')); $('#f-x').onclick = closeFmt; set('#b-sync', ic('sync') + ' Sinkronkan sekarang');
  const N = document.querySelectorAll('nav button'); N[0].innerHTML = ic('map') + 'PETA'; N[1].innerHTML = ic('list') + 'PERSIL'; N[2].innerHTML = ic('layers') + 'SATELIT'; N[3].innerHTML = ic('sync') + 'SINKRON';
  N.forEach(b => b.onclick = () => b.dataset.v ? go(b.dataset.v) : (setLayer(), toast(S.layer === 'sat' ? 'Citra satelit' : 'Peta jalan')));
  initMap(); draw();
  $('#b-loc').onclick = () => startGps(() => map.setView(S.gps.ll, 19));
  $('#b-all').onclick = fitAll;
  const need = () => S.draw || (toast('Tekan "Buat Polygon Baru" dulu'), false);
  $('#b-new').onclick = () => setDraw(true);
  $('#b-cancel').onclick = () => { if (!S.pts.length || confirm('Batalkan polygon yang sedang dibuat?')) setDraw(false); };
  $('#b-undo').onclick = () => { if (need()) { S.pts.pop(); S.sel = -1; draw(); } };
  $('#b-reset').onclick = () => { if (need() && S.pts.length && confirm('Hapus semua titik?')) { S.pts = []; S.sel = -1; draw(); } };
  $('#b-gps').onclick = () => startGps(() => { S.pts.push(S.gps.ll); S.sel = -1; draw(); map.setView(S.gps.ll, Math.max(map.getZoom(), 19)); });
  $('#b-pt').onclick = () => { if (!need()) return; const c = map.getCenter(); S.pts.push([c.lat, c.lng]); S.sel = -1; draw(); };
  $('#b-save').onclick = openSheet; $('#f-kt').addEventListener('input', fillNp);
  const srClose = () => { $('.srch').classList.remove('on'); $('#sq').value = ''; $('#sr').className = 'sr'; tmp.clearLayers(); };
  $('#b-sr').onclick = () => { const b = $('.srch'); if (b.classList.contains('on')) srClose(); else { b.classList.add('on'); $('#sq').focus(); } };
  $('#sx').onclick = () => { if ($('#sq').value) { $('#sq').value = ''; $('#sr').className = 'sr'; tmp.clearLayers(); $('#sq').focus(); } else srClose(); };
  $('#sb').onclick = search; $('#sq').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
  $('#q').oninput = e => { S.fq = e.target.value; renderList(); }; $('#fg').onchange = e => { S.fg = e.target.value; renderList(); };
  $('#b-sync').onclick = async () => { toast('Menyinkronkan…'); await flush(); const ok = await refresh(true); if (ok) { go('peta'); setTimeout(fitAll, 80); toast('Tersinkron: ' + all().length + ' lahan ditampilkan'); } else toast('Gagal: ' + S.err); };
  $('#inst-ok').onclick = async () => { if (!dp) return; dp.prompt(); await dp.userChoice; dp = null; hideInst(); };
  $('#inst-x').onclick = () => { sessionStorage.setItem('gu_ix', 1); hideInst(); };
  addEventListener('online', () => { flush(); refresh(); });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && (flush(), refresh()));
  renderAll(); showInst();
  const id = new URLSearchParams(location.search).get('id');
  if (id) { const r = all().find(x => x.id === id); if (r) show(r); if (okCfg()) get({ action: 'getById', id }).then(x => x.status === 'success' && !r && show(x.data[0])).catch(() => !r && toast('Data tidak ditemukan')); }
  else if (all().length) fitAll(); else if (!okCfg()) toast('URL server belum diisi di js/config.js — data hanya tersimpan di perangkat');
  else toast('Tekan "Buat Polygon Baru" untuk mulai mengukur lahan');
  refresh().then(flush);
  setInterval(() => document.visibilityState === 'visible' && (flush(), refresh()), 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
init();
})();
