(() => {
'use strict';
const C = window.APP_CONFIG || {}, $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf = (n, d = 2) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);
const R = 6378137, rad = d => d * Math.PI / 180;
const area = p => { const n = p.length; if (n < 3) return 0; let a = 0; for (let i = 0; i < n; i++) a += (rad(p[(i + 2) % n][1]) - rad(p[i][1])) * Math.sin(rad(p[(i + 1) % n][0])); return Math.abs(a * R * R / 2); };
const dist = (a, b) => { const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const perim = p => p.reduce((s, q, i) => s + dist(q, p[(i + 1) % p.length]), 0);
const X = '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
let tok = sessionStorage.getItem('gu_adm') || '', rows = [], map, eg, og, epts = [], orig = [], eid = '', sel = -1, tt;
const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 'on'; clearTimeout(tt); tt = setTimeout(() => t.className = '', 3500); };
const ok = () => /^https:\/\/script\.google(usercontent)?\.com\//.test(C.GAS_URL || '') && !/GANTI|XXXX/.test(C.GAS_URL);
async function call(b) {
  if (!ok()) throw new Error('URL server belum diisi di js/config.js');
  const r = await fetch(C.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(b) }), t = await r.text();
  let j; try { j = JSON.parse(t); } catch (e) { throw new Error('Server membalas bukan JSON — periksa Deploy (akses "Siapa saja", versi terbaru)'); }
  if (j.status !== 'success') { if (/Sesi/.test(j.message || '')) keluar(true); throw new Error(j.message || 'Gagal'); }
  return j;
}
const keluar = (silent) => { tok = ''; sessionStorage.removeItem('gu_adm'); $('#panel').hidden = true; $('#login').hidden = false; $('#out').hidden = true; $('#sheet').className = 'sheet'; if (!silent) toast('Keluar'); };
function tampil() { $('#login').hidden = true; $('#panel').hidden = false; $('#out').hidden = false; load(); }
async function load() {
  try { const j = await (await fetch(C.GAS_URL + '?action=read')).json(); if (j.status !== 'success') throw new Error(j.message); rows = j.data; render(); }
  catch (e) { toast('Gagal memuat: ' + e.message); }
}
const parse = r => { try { return JSON.parse(r.koordinat_json); } catch (e) { return []; } };
function render() {
  const q = $('#q').value.toLowerCase(), f = rows.filter(r => !q || (r.nama_petani + ' ' + r.nama_lahan + ' ' + r.kelompok_tani).toLowerCase().includes(q));
  $('#sum').textContent = `${f.length} dari ${rows.length} lahan`;
  $('#list').innerHTML = f.map(r => `<div class="item" data-id="${esc(r.id)}"><b>${esc(r.nama_petani)}</b> <span class="mono">${nf(r.luas_m2)} m² • ${nf(r.luas_ha, 4)} Ha • ${nf(r.luas_m2 / 400)} rante</span><br>${esc(r.kelompok_tani)} • ${esc(r.nama_lahan)}<div class="a"><button class="sec" data-a="e">Edit</button><button class="red" data-a="d">Hapus</button></div></div>`).join('') || '<div class="box" style="margin-top:12px">Belum ada data.</div>';
}
$('#list').onclick = async e => {
  const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.closest('.item').dataset.id, r = rows.find(x => x.id === id); if (!r) return;
  if (b.dataset.a === 'e') return openEdit(r);
  if (!confirm(`HAPUS PERMANEN lahan "${r.nama_lahan}" milik ${r.nama_petani}?\nTindakan ini tidak bisa dibatalkan.`)) return;
  try { await call({ action: 'admin.delete', token: tok, id }); toast('Lahan dihapus'); await load(); } catch (er) { toast(er.message); }
};
$('#q').oninput = render;

// ---------- Edit poligon ----------
function initMap() {
  map = L.map('emap', { attributionControl: false, tap: true }); L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
  og = L.layerGroup().addTo(map); eg = L.layerGroup().addTo(map);
}
function openEdit(r) {
  eid = r.id; epts = parse(r).map(q => q.slice()); orig = parse(r).map(q => q.slice()); sel = -1; $('#e-err').textContent = '';
  $('#e-kt').value = r.kelompok_tani; $('#e-np').value = r.nama_petani; $('#e-nl').value = r.nama_lahan; $('#e-ct').value = r.catatan || '';
  $('#sheet').className = 'sheet on';
  if (!map) initMap();
  setTimeout(() => { map.invalidateSize(); og.clearLayers();
    rows.filter(x => x.id !== eid).forEach(x => { const p = parse(x); if (p.length > 2) L.polygon(p, { color: '#CBD5E1', weight: 2, dashArray: '5 5', fillOpacity: .12, interactive: false }).addTo(og); });
    drawE(); map.fitBounds(L.latLngBounds(epts), { padding: [30, 30], maxZoom: 19 }); }, 260);
}
function drawE() {
  eg.clearLayers(); const p = epts;
  const poly = L.polygon(p, { color: '#F59E0B', weight: 3, fillColor: '#F59E0B', fillOpacity: .28, interactive: false }).addTo(eg);
  p.forEach((q, i) => L.marker(q, { draggable: true, icon: L.divIcon({ className: 'vx' + (i === sel ? ' sel' : ''), iconSize: [36, 36] }) }).addTo(eg)
    .on('click', () => { sel = i; drawE(); }).on('drag', ev => { const l = ev.target.getLatLng(); p[i] = [l.lat, l.lng]; poly.setLatLngs(p); sum(); }).on('dragend', drawE));
  p.forEach((q, i) => { const n = p[(i + 1) % p.length], m = [(q[0] + n[0]) / 2, (q[1] + n[1]) / 2]; L.circleMarker(m, { radius: 7, weight: 2, color: '#0F172A', fillColor: '#fff', fillOpacity: .9, bubblingMouseEvents: false }).addTo(eg).on('click', () => { p.splice(i + 1, 0, m); sel = i + 1; drawE(); }); });
  sum();
}
const sum = () => $('#e-sum').textContent = `${nf(area(epts))} m² • ${nf(area(epts) / 1e4, 4)} Ha • ${nf(area(epts) / 400)} rante • ${epts.length} titik` + (sel >= 0 ? ` • titik ${sel + 1} dipilih` : '');
$('#e-dp').onclick = () => { if (sel < 0) return toast('Ketuk titik yang ingin dihapus dulu'); if (epts.length <= 3) return toast('Poligon minimal 3 titik'); epts.splice(sel, 1); sel = -1; drawE(); };
$('#e-rs').onclick = () => { epts = orig.map(q => q.slice()); sel = -1; drawE(); map.fitBounds(L.latLngBounds(epts), { padding: [30, 30], maxZoom: 19 }); };
$('#e-x').innerHTML = X; $('#e-x').onclick = () => $('#sheet').className = 'sheet';
$('#e-ok').onclick = async () => {
  const kt = $('#e-kt').value.trim(), np = $('#e-np').value.trim(); if (!kt || !np) return ($('#e-err').textContent = 'Kelompok tani & nama petani wajib diisi');
  $('#e-ok').disabled = true; $('#e-err').textContent = '';
  try {
    await call({ action: 'admin.update', token: tok, id: eid, payload: { kelompok_tani: kt, nama_petani: np, nama_lahan: $('#e-nl').value.trim(), catatan: $('#e-ct').value.trim(), koordinat_json: JSON.stringify(epts.map(q => [+q[0].toFixed(7), +q[1].toFixed(7)])) } });
    $('#sheet').className = 'sheet'; toast('Perubahan disimpan'); await load();
  } catch (e) { $('#e-err').textContent = e.message; }
  $('#e-ok').disabled = false;
};

// ---------- Masuk / keluar / ganti sandi ----------
$('#in').onclick = async () => {
  $('#lerr').textContent = ''; $('#in').disabled = true;
  try { const j = await call({ action: 'admin.login', user: $('#u').value.trim(), pass: $('#p').value }); tok = j.token; sessionStorage.setItem('gu_adm', tok); $('#p').value = ''; $('#wg').hidden = !j.wajibGanti; tampil(); }
  catch (e) { $('#lerr').textContent = e.message; }
  $('#in').disabled = false;
};
$('#p').addEventListener('keydown', e => { if (e.key === 'Enter') $('#in').click(); });
$('#out').onclick = () => keluar();
$('#gok').onclick = async () => {
  try { const j = await call({ action: 'admin.ganti', token: tok, lama: $('#g1').value, baru: $('#g2').value }); tok = j.token; sessionStorage.setItem('gu_adm', tok); $('#g1').value = $('#g2').value = ''; $('#wg').hidden = true; toast('Kata sandi diganti'); }
  catch (e) { toast(e.message); }
};
if (tok) call({ action: 'admin.cek', token: tok }).then(tampil).catch(() => keluar(true));
})();
