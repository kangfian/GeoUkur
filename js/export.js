// GeoUkur — ekspor lahan ke KML, KMZ, GeoJSON, Esri Shapefile, PDF, dan Gambar (PNG). Semua dibuat di browser.
(() => {
'use strict';
const enc = new TextEncoder();
const nf = (n, d = 2) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);
const P = r => JSON.parse(r.koordinat_json); // [[lat,lng],...]
const xml = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rad = d => d * Math.PI / 180, RE = 6378137;
const dist = (a, b) => { const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2; return 2 * RE * Math.asin(Math.sqrt(h)); };
const fm = m => m >= 1000 ? nf(m / 1000, 2) + ' km' : nf(m, m < 100 ? 1 : 0) + ' m';
const m2s = rows => rows.reduce((s, r) => s + +r.luas_m2, 0);
const tgl = () => new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const baseName = rows => rows.length === 1 ? ([slug(rows[0].nama_petani), slug(rows[0].nama_lahan)].filter(Boolean).join('_') || rows[0].id) : (slug(rows[0].nama_petani) || 'GeoUkur') + '_rekap';

// ---------- KML / GeoJSON ----------
function kml(rows, o) {
  const hex = n => n.toString(16).padStart(2, '0');
  const pm = rows.map(r => {
    const c = P(r).map(q => `${q[1]},${q[0]},0`); c.push(c[0]); const [R, G, B] = rgb(o.colorOf(r));
    const data = { kelompok_tani: r.kelompok_tani, nama_petani: r.nama_petani, nama_lahan: r.nama_lahan, luas_m2: r.luas_m2, luas_ha: r.luas_ha, rante: +(r.luas_m2 / 400).toFixed(2), catatan: r.catatan || '', tautan: o.link(r) };
    return `<Placemark><name>${xml(r.nama_petani)} — ${xml(r.nama_lahan)}</name><description>${xml(`Kelompok Tani: ${r.kelompok_tani}\nLuas: ${nf(r.luas_m2)} m² (${nf(r.luas_ha, 4)} Ha • ${nf(r.luas_m2 / 400)} rante)`)}</description>
<Style><LineStyle><color>ff${hex(B)}${hex(G)}${hex(R)}</color><width>3</width></LineStyle><PolyStyle><color>66${hex(B)}${hex(G)}${hex(R)}</color></PolyStyle></Style>
<ExtendedData>${Object.keys(data).map(k => `<Data name="${k}"><value>${xml(data[k])}</value></Data>`).join('')}</ExtendedData>
<Polygon><outerBoundaryIs><LinearRing><coordinates>${c.join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>GeoUkur by Irpan — ${xml(rows[0].nama_petani)}</name>\n${pm}\n</Document></kml>`;
}
function geojson(rows, o) {
  return JSON.stringify({ type: 'FeatureCollection', features: rows.map(r => { const c = P(r).map(q => [q[1], q[0]]); c.push(c[0]);
    return { type: 'Feature', properties: { id: r.id, kelompok_tani: r.kelompok_tani, nama_petani: r.nama_petani, nama_lahan: r.nama_lahan, luas_m2: +r.luas_m2, luas_ha: +r.luas_ha, rante: +(r.luas_m2 / 400).toFixed(2), catatan: r.catatan || '', tautan: o.link(r) }, geometry: { type: 'Polygon', coordinates: [c] } }; }) }, null, 1);
}

// ---------- ZIP (tanpa kompresi) ----------
const CT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files, type) {
  const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const parts = [], cen = []; let off = 0;
  files.forEach(f => {
    const nm = enc.encode(f.name), cr = crc(f.data), n = f.data.length;
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, cr, true); h.setUint32(18, n, true); h.setUint32(22, n, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true); c.setUint32(16, cr, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + n;
  });
  const cs = cen.reduce((s, u) => s + u.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: type || 'application/zip' });
}

// ---------- Esri Shapefile (.shp .shx .dbf .prj .cpg) ----------
function shapefile(rows) {
  const polys = rows.map(r => { const p = P(r).map(q => [q[1], q[0]]); const ar = p.reduce((s, q, i) => { const n = p[(i + 1) % p.length]; return s + (n[0] - q[0]) * (n[1] + q[1]); }, 0); if (ar < 0) p.reverse(); p.push(p[0]); return p; }); // cincin luar searah jarum jam
  const recs = polys.map((p, i) => {
    const n = p.length, len = 48 + 16 * n, b = new DataView(new ArrayBuffer(8 + len)); b.setInt32(0, i + 1, false); b.setInt32(4, len / 2, false);
    let o = 8; b.setInt32(o, 5, true); o += 4; const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].forEach(v => { b.setFloat64(o, v, true); o += 8; });
    b.setInt32(o, 1, true); b.setInt32(o + 4, n, true); b.setInt32(o + 8, 0, true); o += 12; p.forEach(q => { b.setFloat64(o, q[0], true); b.setFloat64(o + 8, q[1], true); o += 16; }); return b;
  });
  const all = [].concat(...polys), bb = [Math.min(...all.map(q => q[0])), Math.min(...all.map(q => q[1])), Math.max(...all.map(q => q[0])), Math.max(...all.map(q => q[1])), 0, 0, 0, 0];
  const hdr = bytes => { const h = new DataView(new ArrayBuffer(100)); h.setInt32(0, 9994, false); h.setInt32(24, bytes / 2, false); h.setInt32(28, 1000, true); h.setInt32(32, 5, true); bb.forEach((v, i) => h.setFloat64(36 + 8 * i, v, true)); return new Uint8Array(h.buffer); };
  const cat = a => { const o = new Uint8Array(a.reduce((s, u) => s + u.length, 0)); let k = 0; a.forEach(u => { o.set(u, k); k += u.length; }); return o; };
  const shpBytes = 100 + recs.reduce((s, r) => s + r.byteLength, 0);
  const shp = cat([hdr(shpBytes), ...recs.map(r => new Uint8Array(r.buffer))]);
  const shx = new DataView(new ArrayBuffer(100 + 8 * recs.length)); new Uint8Array(shx.buffer).set(hdr(100 + 8 * recs.length));
  let off = 100; recs.forEach((r, i) => { shx.setInt32(100 + 8 * i, off / 2, false); shx.setInt32(104 + 8 * i, (r.byteLength - 8) / 2, false); off += r.byteLength; });
  const F = [['ID', 'C', 20, 0], ['KELOMPOK', 'C', 50, 0], ['PETANI', 'C', 50, 0], ['LAHAN', 'C', 50, 0], ['LUAS_M2', 'N', 16, 2], ['LUAS_HA', 'N', 14, 4], ['RANTE', 'N', 14, 2], ['CATATAN', 'C', 100, 0]];
  const rl = 1 + F.reduce((s, f) => s + f[2], 0), hl = 33 + 32 * F.length, d = new Date(), db = new Uint8Array(hl + rl * rows.length + 1), dv = new DataView(db.buffer);
  db[0] = 3; db[1] = d.getFullYear() - 1900; db[2] = d.getMonth() + 1; db[3] = d.getDate(); dv.setUint32(4, rows.length, true); dv.setUint16(8, hl, true); dv.setUint16(10, rl, true);
  F.forEach((f, i) => { const b = 32 + 32 * i; db.set(enc.encode(f[0]), b); db[b + 11] = f[1].charCodeAt(0); db[b + 16] = f[2]; db[b + 17] = f[3]; }); db[32 + 32 * F.length] = 0x0D;
  const fit = (s, n) => { let b = enc.encode(String(s ?? '')); if (b.length > n) { let k = n; while (k > 0 && (b[k] & 0xC0) === 0x80) k--; b = b.slice(0, k); } const o = new Uint8Array(n).fill(32); o.set(b); return o; };
  const num = (v, n, dd) => enc.encode((+v || 0).toFixed(dd).padStart(n, ' ').slice(-n));
  rows.forEach((r, i) => { let o = hl + rl * i; db[o++] = 32; const vals = [fit(r.id, 20), fit(r.kelompok_tani, 50), fit(r.nama_petani, 50), fit(r.nama_lahan, 50), num(r.luas_m2, 16, 2), num(r.luas_ha, 14, 4), num(r.luas_m2 / 400, 14, 2), fit(r.catatan, 100)]; vals.forEach(v => { db.set(v, o); o += v.length; }); });
  db[db.length - 1] = 0x1A;
  const prj = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  return [{ name: 'lahan.shp', data: shp }, { name: 'lahan.shx', data: new Uint8Array(shx.buffer) }, { name: 'lahan.dbf', data: db }, { name: 'lahan.prj', data: enc.encode(prj) }, { name: 'lahan.cpg', data: enc.encode('UTF-8') }];
}

// ---------- Peta: proyeksi Web Mercator + citra satelit Esri ----------
const TS = ['https://server.arcgisonline.com', 'https://services.arcgisonline.com'];
const wx = lng => (lng + 180) / 360 * 256, wy = lat => { const s = Math.sin(rad(lat)); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256; }; // piksel dunia pada zoom 0
function fitMap(rows, bw, bh, pad) { // y ke BAWAH (seperti kanvas)
  const all = [].concat(...rows.map(P)), xs = all.map(q => wx(q[1])), ys = all.map(q => wy(q[0]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const sc = Math.min((bw - 2 * pad) / ((x1 - x0) || 1e-7), (bh - 2 * pad) / ((y1 - y0) || 1e-7), 2 ** 21), la = all.reduce((a, q) => a + q[0], 0) / all.length;
  return { sc, zf: Math.log2(sc), cx, cy, bw, bh, f: q => [(wx(q[1]) - cx) * sc + bw / 2, (wy(q[0]) - cy) * sc + bh / 2], ppm: sc / (40075016.686 * Math.cos(rad(la)) / 256) };
}
async function getTile(z, x, y) {
  for (const h of TS) { try { const ac = new AbortController(), to = setTimeout(() => ac.abort(), 12000); const r = await fetch(`${h}/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, { mode: 'cors', signal: ac.signal }); clearTimeout(to); if (!r.ok) continue; const b = new Uint8Array(await r.arrayBuffer()); if (b.length > 300) return b; } catch (e) {} }
  return null;
}
async function tiles(fit, nat) { // daftar tile satelit yang menutupi kotak peta; null bila tidak ada yang bisa diambil
  const zt = Math.max(3, Math.min(Math.round(fit.zf), nat || 18)), n = 2 ** zt, ts = 256 / n;
  const l = fit.cx - fit.bw / 2 / fit.sc, r = fit.cx + fit.bw / 2 / fit.sc, t = fit.cy - fit.bh / 2 / fit.sc, b = fit.cy + fit.bh / 2 / fit.sc, jobs = [];
  for (let ty = Math.max(0, Math.floor(t / ts)); ty <= Math.min(n - 1, Math.floor(b / ts)); ty++) for (let tx = Math.max(0, Math.floor(l / ts)); tx <= Math.min(n - 1, Math.floor(r / ts)); tx++)
    jobs.push({ tx, ty, x: (tx * ts - fit.cx) * fit.sc + fit.bw / 2, y: (ty * ts - fit.cy) * fit.sc + fit.bh / 2, w: ts * fit.sc });
  if (!jobs.length || jobs.length > 80) return null;
  let i = 0; await Promise.all(Array.from({ length: 6 }, async () => { while (i < jobs.length) { const j = jobs[i++]; j.buf = await getTile(zt, j.tx, j.ty); } }));
  const ok = jobs.filter(j => j.buf); return ok.length ? ok : null;
}
const nice = m => [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000].filter(v => v <= m).pop() || 1;
const ctr = r => { const p = P(r); return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; };
const ll6 = q => q[0].toFixed(6) + ', ' + q[1].toFixed(6);
const dms = (v, p, n) => { const a = Math.abs(v), d = Math.floor(a), mm = Math.floor((a - d) * 60), s = ((a - d) * 60 - mm) * 60; return `${d}\u00B0${String(mm).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"${v >= 0 ? p : n}`; };
const info = rows => rows.length === 1
  ? [['Kelompok Tani', rows[0].kelompok_tani], ['Nama Petani', rows[0].nama_petani], ['Nama Lahan', rows[0].nama_lahan || '-'], ['Catatan', rows[0].catatan || '-']]
  : [['Kelompok Tani', rows[0].kelompok_tani], ['Nama Petani', rows[0].nama_petani], ['Jumlah Lahan', rows.length + ' lahan']];
const KREDIT = 'Citra: Esri, Maxar, Earthstar Geographics';

// ---------- PDF ----------
async function pdf(rows, o) {
  const L = t => String(t ?? '').replace(/[–—]/g, '-').replace(/•/g, '\xB7').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?').replace(/[\\()]/g, '\\$&');
  const tw = (t, s) => [...String(t)].reduce((a, ch) => a + (/\d/.test(ch) ? .556 : /[.,]/.test(ch) ? .278 : .6), 0) * s;
  let c = ''; const col = (h, st) => { const [r, g, b] = rgb(h).map(v => (v / 255).toFixed(3)); return `${r} ${g} ${b} ${st ? 'RG' : 'rg'}\n`; };
  const T = (x, y, s, t, f = 'F1', h = '#0F172A') => c += col(h) + `BT /${f} ${s} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${L(t)}) Tj ET\n`;
  const TR = (xr, y, s, t, f = 'F1') => T(xr - tw(t, s), y, s, t, f);
  const bx = 36, by = 330, bw = 523, bh = 320, fit = fitMap(rows, bw, bh, 46), tl = await tiles(fit, o.nat), jp = (tl || []).filter(j => j.buf[0] === 0xFF && j.buf[1] === 0xD8);
  const X = q => { const p = fit.f(q); return [bx + p[0], by + bh - p[1]]; };
  c += col('#047857') + '0 782 595 60 re f\n'; T(36, 806, 20, 'GeoUkur by Irpan', 'F2', '#FFFFFF'); T(36, 791, 9, 'Laporan Pengukuran Lahan', 'F1', '#FFFFFF'); TR(559, 806, 9, tgl(), 'F1');
  const inf = info(rows), m = m2s(rows); let y = 764;
  inf.forEach(([k, v]) => { T(36, y, 9, k.toUpperCase(), 'F2'); T(140, y, 10.5, String(v).slice(0, 78), 'F1'); y -= 14; });
  [['LUAS (m2)', nf(m)], ['HEKTAR (Ha)', nf(m / 1e4, 4)], ['RANTE', nf(m / 400)]].forEach(([k, v], i) => { const x = 36 + i * 178; c += col('#0F172A', 1) + col('#F8FAFC') + `1.5 w ${x} 658 168 40 re B\n`; T(x + 8, 685, 7.5, k, 'F2'); T(x + 8, 667, 14, v, 'F2'); });
  c += 'q ' + `${bx} ${by} ${bw} ${bh} re W n\n` + col('#E8EEF3') + `${bx} ${by} ${bw} ${bh} re f\n`;
  jp.forEach((j, k) => { c += `q ${(j.w + .6).toFixed(2)} 0 0 ${(j.w + .6).toFixed(2)} ${(bx + j.x - .3).toFixed(2)} ${(by + bh - j.y - j.w - .3).toFixed(2)} cm /I${k} Do Q\n`; });
  const sat = jp.length > 0; c += 'Q\n';
  rows.forEach(r => {
    const p = P(r), hex = o.colorOf(r), path = p.map((q, i) => { const [a, b] = X(q); return `${a.toFixed(1)} ${b.toFixed(1)} ${i ? 'l' : 'm'}`; }).join(' ') + ' h';
    c += `q /A1 gs ${col(hex)}${path} f Q\nq 1 j ${col('#FFFFFF', 1)}6 w ${path} S Q\nq 1 j ${col(hex, 1)}3 w ${path} S Q\n`;
    p.forEach(q => { const [a, b] = X(q); c += col('#FFFFFF') + col('#0F172A', 1) + `1 w ${(a - 3).toFixed(1)} ${(b - 3).toFixed(1)} 6 6 re B\n`; });
    const lab = (x, yy, t, f = 'F2', sz = 7) => { const w = tw(t, sz) + 5; c += `q /A2 gs ${col('#FFFFFF')}${(x - w / 2).toFixed(1)} ${(yy - 2).toFixed(1)} ${w.toFixed(1)} ${sz + 3.5} re f Q\n`; T(x - tw(t, sz) / 2, yy, sz, t, f); };
    if (rows.length === 1) { p.forEach((q, i) => { const n = p[(i + 1) % p.length], a = X(q), b = X(n); lab((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 5, fm(dist(q, n))); }); p.forEach((q, i) => { const a = X(q); lab(a[0] + 11, a[1] + 8, 'T' + (i + 1), 'F2', 7); }); }
    else { const a = [0, 1].map(k => p.reduce((s, q) => s + X(q)[k], 0) / p.length); lab(a[0], a[1], String(r.nama_lahan || '').slice(0, 18)); }
  });
  const nl = nice(120 / fit.ppm), bl = nl * fit.ppm; c += `q /A2 gs ${col('#FFFFFF')}${bx + 8} ${by + 8} ${bl + 20} 30 re f Q\n` + col('#0F172A', 1) + `2 w ${bx + 18} ${by + 16} m ${bx + 18 + bl} ${by + 16} l S\n${bx + 18} ${by + 12} m ${bx + 18} ${by + 20} l S ${bx + 18 + bl} ${by + 12} m ${bx + 18 + bl} ${by + 20} l S\n`; T(bx + 18, by + 25, 8, nl >= 1000 ? nl / 1000 + ' km' : nl + ' m', 'F2');
  c += `q /A2 gs ${col('#FFFFFF')}${bx + bw - 26} ${by + bh - 58} 22 52 re f Q\n` + col('#0F172A') + `${bx + bw - 15} ${by + bh - 24} m ${bx + bw - 22} ${by + bh - 44} l ${bx + bw - 15} ${by + bh - 39} l ${bx + bw - 8} ${by + bh - 44} l f\n`; T(bx + bw - 19, by + bh - 16, 9, 'U', 'F2');
  const kr = sat ? KREDIT : 'Citra satelit tidak dapat dimuat (periksa internet) - sketsa polos'; c += `q /A2 gs ${col('#FFFFFF')}${bx + bw - tw(kr, 6.5) - 12} ${by + 3} ${tw(kr, 6.5) + 8} 10 re f Q\n`; T(bx + bw - tw(kr, 6.5) - 8, by + 6, 6.5, kr);
  c += col('#0F172A', 1) + `1.5 w ${bx} ${by} ${bw} ${bh} re S\n`;
  T(36, 312, 8, 'NO', 'F2'); T(58, 312, 8, 'NAMA LAHAN', 'F2'); TR(300, 312, 8, 'LUAS (m2)', 'F2'); TR(352, 312, 8, 'HEKTAR', 'F2'); TR(394, 312, 8, 'RANTE', 'F2'); T(410, 312, 8, 'TITIK PUSAT (LINTANG, BUJUR)', 'F2'); c += col('#0F172A', 1) + '1 w 36 307 m 559 307 l S\n';
  let ty = 294; const mx = rows.length === 1 ? 1 : 12; rows.slice(0, mx).forEach((r, i) => { T(36, ty, 9, String(i + 1)); T(58, ty, 9, String(r.nama_lahan || '(tanpa nama)').slice(0, 30)); TR(300, ty, 9, nf(r.luas_m2)); TR(352, ty, 9, nf(r.luas_ha, 4)); TR(394, ty, 9, nf(r.luas_m2 / 400)); T(410, ty, 7.5, ll6(ctr(r))); ty -= 13; });
  if (rows.length > mx) { T(58, ty, 8, `... dan ${rows.length - mx} lahan lainnya (lihat file KML / Shapefile)`); ty -= 13; }
  if (rows.length === 1) {
    ty -= 12; c += col('#0F172A', 1) + `1 w 36 ${ty + 10} m 559 ${ty + 10} l S\n`; T(36, ty - 2, 9, 'KOORDINAT TITIK BATAS (WGS84)', 'F2'); ty -= 18;
    [['TITIK', 36], ['LINTANG', 78], ['BUJUR', 150], ['LINTANG (DMS)', 240], ['BUJUR (DMS)', 400]].forEach(([k, x]) => T(x, ty, 7.5, k, 'F2')); ty -= 12;
    const pp = P(rows[0]); pp.slice(0, 16).forEach((q, i) => { T(36, ty, 8.5, 'T' + (i + 1), 'F2'); T(78, ty, 8.5, q[0].toFixed(6)); T(150, ty, 8.5, q[1].toFixed(6)); T(240, ty, 8.5, dms(q[0], 'LU', 'LS')); T(400, ty, 8.5, dms(q[1], 'BT', 'BB')); ty -= 12; });
    if (pp.length > 16) T(36, ty, 8, `... dan ${pp.length - 16} titik lainnya (lihat file KML / GeoJSON / Shapefile)`);
  }
  T(36, 26, 8, 'Dibuat dengan GeoUkur by Irpan  \xB7  1 rante = 400 m2  \xB7  Koordinat WGS84' + (rows.length === 1 && o.link(rows[0]) ? '  \xB7  ' + o.link(rows[0]).slice(0, 70) : ''));
  const objs = ['', '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /ExtGState << /A1 7 0 R /A2 8 0 R >> /XObject << ${jp.map((_, k) => `/I${k} ${9 + k} 0 R`).join(' ')} >> >> /Contents 4 0 R >>`,
    `<< /Length ${c.length} >>\nstream\n${c}endstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /ExtGState /ca 0.3 >>', '<< /Type /ExtGState /ca 0.85 >>'];
  jp.forEach(j => { let b = ''; for (let i = 0; i < j.buf.length; i += 8192) b += String.fromCharCode.apply(null, j.buf.subarray(i, i + 8192)); objs.push(`<< /Type /XObject /Subtype /Image /Width 256 /Height 256 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.buf.length} >>\nstream\n${b}\nendstream`); });
  let out = '%PDF-1.4\n'; const xr = []; for (let i = 1; i < objs.length; i++) { xr.push(out.length); out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xo = out.length; out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + xr.map(v => String(v).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xo}\n%%EOF`;
  return new Blob([Uint8Array.from(out, ch => ch.charCodeAt(0) & 255)], { type: 'application/pdf' });
}

// ---------- Gambar (PNG) ----------
async function png(rows, o) {
  try { await document.fonts.load('800 30px "Plus Jakarta Sans"'); await document.fonts.load('700 30px "JetBrains Mono"'); } catch (e) {}
  const SF = '"Plus Jakarta Sans", system-ui, sans-serif', MF = '"JetBrains Mono", ui-monospace, monospace', W = 1080, mx = 40, my = 356, mw = 1000, mh = 880;
  const fit = fitMap(rows, mw, mh, 110), tl = await tiles(fit, o.nat), bm = [];
  for (const j of tl || []) { try { bm.push({ j, im: await createImageBitmap(new Blob([j.buf])) }); } catch (e) {} }
  const sat = bm.length > 0, single = rows.length === 1;
  const cr = single ? [['PUSAT', ctr(rows[0])]].concat(P(rows[0]).slice(0, 12).map((q, i) => ['T' + (i + 1), q])) : rows.slice(0, 12).map(r => [String(r.nama_lahan || '(tanpa nama)').slice(0, 20), ctr(r)]);
  const cy0 = my + mh + 24, ch = 88 + cr.length * 40, H = cy0 + ch + 120, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const txt = (t, x, y, s, w = 700, f = SF, col = '#0F172A', al = 'left') => { g.font = `${w} ${s}px ${f}`; g.fillStyle = col; g.textAlign = al; g.textBaseline = 'alphabetic'; g.fillText(t, x, y); };
  const rr = (x, y, w, h, r, fill, stroke, lw = 3) => { g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); } };
  g.fillStyle = '#EEF2F6'; g.fillRect(0, 0, W, H); g.fillStyle = '#047857'; g.fillRect(0, 0, W, 112);
  txt('GeoUkur', 44, 66, 44, 800, SF, '#fff'); txt('by Irpan', 256, 66, 24, 700, SF, '#fff'); txt('Laporan Pengukuran Lahan', 44, 96, 20, 600, SF, '#D1FAE5'); txt(tgl(), W - 44, 66, 22, 600, SF, '#fff', 'right');
  const m = m2s(rows);
  rr(40, 140, 1000, 190, 18, '#fff', '#0F172A'); txt(String(rows[0].nama_petani), 66, 190, 40, 800); txt(single ? `${rows[0].kelompok_tani}  •  ${rows[0].nama_lahan || '(tanpa nama)'}` : `${rows[0].kelompok_tani}  •  ${rows.length} lahan (rekap)`, 66, 228, 24, 600);
  [['LUAS', nf(m) + ' m²'], ['HEKTAR', nf(m / 1e4, 4) + ' Ha'], ['RANTE', nf(m / 400)]].forEach(([k, v], i) => { const x = 66 + i * 316; rr(x, 248, 296, 66, 12, '#F8FAFC', '#0F172A', 2.5); txt(k, x + 14, 270, 15, 800); txt(v, x + 14, 302, 28, 700, MF); });
  rr(mx, my, mw, mh, 18, '#E8EEF3', null);
  g.save(); g.beginPath(); g.roundRect(mx, my, mw, mh, 18); g.clip();
  if (sat) bm.forEach(({ j, im }) => g.drawImage(im, mx + j.x - .5, my + j.y - .5, j.w + 1, j.w + 1));
  else { g.strokeStyle = '#CBD5E1'; g.lineWidth = 1; for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(mx + i * 100, my); g.lineTo(mx + i * 100, my + mh); g.stroke(); g.beginPath(); g.moveTo(mx, my + i * 88); g.lineTo(mx + mw, my + i * 88); g.stroke(); } }
  const X = q => { const p = fit.f(q); return [mx + p[0], my + p[1]]; };
  rows.forEach(r => { const p = P(r), hex = o.colorOf(r), [R, G, B] = rgb(hex);
    g.beginPath(); p.forEach((q, i) => { const a = X(q); i ? g.lineTo(a[0], a[1]) : g.moveTo(a[0], a[1]); }); g.closePath(); g.fillStyle = `rgba(${R},${G},${B},.3)`; g.fill(); g.lineJoin = 'round'; g.lineWidth = 11; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke(); g.lineWidth = 6; g.strokeStyle = hex; g.stroke();
    if (single) p.forEach((q, i) => { const n = p[(i + 1) % p.length], a = X(q), b = X(n); let ang = Math.atan2(b[1] - a[1], b[0] - a[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang <= -Math.PI / 2) ang += Math.PI; const t = fm(dist(q, n));
      g.save(); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); g.rotate(ang); g.font = `700 24px ${MF}`; const w = g.measureText(t).width + 22; rr(-w / 2, -44, w, 34, 8, '#0F172A', '#fff', 2); txt(t, 0, -19, 24, 700, MF, '#fff', 'center'); g.restore(); });
    p.forEach((q, i) => { const a = X(q); g.beginPath(); g.arc(a[0], a[1], 12, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = hex; g.stroke();
      if (single) { const t = 'T' + (i + 1); g.font = `800 20px ${SF}`; const w = g.measureText(t).width + 14; rr(a[0] + 14, a[1] - 34, w, 28, 7, '#fff', '#0F172A', 2); txt(t, a[0] + 21, a[1] - 13, 20, 800); } });
    if (!single) { const a = [0, 1].map(k => p.reduce((s, q) => s + X(q)[k], 0) / p.length), t = String(r.nama_lahan || '').slice(0, 22); g.font = `700 22px ${SF}`; const w = g.measureText(t).width + 20; rr(a[0] - w / 2, a[1] - 18, w, 36, 9, '#fff', hex, 3); txt(t, a[0], a[1] + 7, 22, 700, SF, '#0F172A', 'center'); }
  });
  const nl = nice(260 / fit.ppm), bl = nl * fit.ppm; rr(mx + 18, my + mh - 92, bl + 36, 74, 12, 'rgba(255,255,255,.88)', null); g.strokeStyle = '#0F172A'; g.lineWidth = 6; g.beginPath(); g.moveTo(mx + 36, my + mh - 40); g.lineTo(mx + 36 + bl, my + mh - 40); g.moveTo(mx + 36, my + mh - 52); g.lineTo(mx + 36, my + mh - 28); g.moveTo(mx + 36 + bl, my + mh - 52); g.lineTo(mx + 36 + bl, my + mh - 28); g.stroke(); txt(nl >= 1000 ? nl / 1000 + ' km' : nl + ' m', mx + 36, my + mh - 62, 22, 800, MF);
  rr(mx + mw - 90, my + 22, 66, 102, 12, 'rgba(255,255,255,.88)', null); g.fillStyle = '#0F172A'; g.beginPath(); g.moveTo(mx + mw - 57, my + 36); g.lineTo(mx + mw - 77, my + 86); g.lineTo(mx + mw - 57, my + 74); g.lineTo(mx + mw - 37, my + 86); g.closePath(); g.fill(); txt('U', mx + mw - 57, my + 114, 24, 800, SF, '#0F172A', 'center');
  const kr = sat ? KREDIT : 'Citra satelit tidak dapat dimuat (periksa internet) — sketsa polos'; g.font = `600 17px ${SF}`; const kw = g.measureText(kr).width + 18; rr(mx + mw - kw - 12, my + mh - 38, kw, 28, 7, 'rgba(255,255,255,.88)', null); txt(kr, mx + mw - 21, my + mh - 18, 17, 600, SF, '#0F172A', 'right'); g.restore();
  rr(mx, my, mw, mh, 18, null, '#0F172A');
  rr(40, cy0, 1000, ch, 18, '#fff', '#0F172A'); txt(single ? 'KOORDINAT TITIK BATAS (WGS84)' : 'KOORDINAT TITIK PUSAT TIAP LAHAN (WGS84)', 66, cy0 + 40, 17, 800); [['TITIK', 66], ['LINTANG', 300], ['BUJUR', 560]].forEach(([k, x]) => txt(k, single ? x : (k === 'TITIK' ? 66 : x + 70), cy0 + 70, 14, 800));
  cr.forEach(([k, q], i) => { const yy = cy0 + 88 + i * 40; if (i % 2 === 0) { g.fillStyle = '#F1F5F9'; g.fillRect(52, yy - 6, 976, 38); } txt(k, 66, yy + 22, 21, 800); txt(q[0].toFixed(6), single ? 300 : 370, yy + 22, 24, 700, MF); txt(q[1].toFixed(6), single ? 560 : 630, yy + 22, 24, 700, MF); if (single && i === 0) txt(dms(q[0], 'LU', 'LS') + '  ' + dms(q[1], 'BT', 'BB'), 1010, yy + 22, 17, 600, MF, '#0F172A', 'right'); });
  const fy = cy0 + ch + 40; txt('Dibuat dengan GeoUkur by Irpan  •  1 rante = 400 m²  •  WGS84', 44, fy, 22, 600);
  const c0 = ctr(rows[0]); txt(`https://maps.google.com/?q=${c0[0].toFixed(6)},${c0[1].toFixed(6)}`, 44, fy + 32, 18, 600, MF); if (single && o.link(rows[0])) txt(o.link(rows[0]).slice(0, 80), 44, fy + 60, 18, 600, MF);
  return new Promise(res => cv.toBlob(res, 'image/png'));
}

window.GeoExport = {
  FORMATS: ['kml', 'kmz', 'geojson', 'shp', 'pdf', 'png'],
  async make(fmt, rows, opt) {
    const o = Object.assign({ colorOf: () => '#047857', link: () => '' }, opt);
    rows = rows.filter(r => { try { return P(r).length > 2; } catch (e) { return false; } }); if (!rows.length) throw new Error('Tidak ada polygon yang valid');
    const b = baseName(rows);
    if (fmt === 'kml') return { blob: new Blob([kml(rows, o)], { type: 'application/vnd.google-earth.kml+xml' }), name: b + '.kml', mime: 'application/vnd.google-earth.kml+xml' };
    if (fmt === 'kmz') return { blob: zip([{ name: 'doc.kml', data: enc.encode(kml(rows, o)) }], 'application/vnd.google-earth.kmz'), name: b + '.kmz', mime: 'application/vnd.google-earth.kmz' };
    if (fmt === 'geojson') return { blob: new Blob([geojson(rows, o)], { type: 'application/geo+json' }), name: b + '.geojson', mime: 'application/geo+json' };
    if (fmt === 'shp') return { blob: zip(shapefile(rows)), name: b + '_shapefile.zip', mime: 'application/zip' };
    if (fmt === 'pdf') return { blob: await pdf(rows, o), name: b + '.pdf', mime: 'application/pdf' };
    if (fmt === 'png') return { blob: await png(rows, o), name: b + '.png', mime: 'image/png' };
    throw new Error('Format tidak dikenal');
  }
};
})();
