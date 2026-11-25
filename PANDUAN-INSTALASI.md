# Panduan Pasang GeoUkur by Irpan

## A. Backend (Google Apps Script) — berkas disalin satu per satu
1. Buka https://script.google.com → **Proyek baru**.
2. Ganti nama `Code.gs` menjadi `Kode`, lalu tempel seluruh isi berkas **Kode.gs**.
3. Menu **Setelan proyek** (ikon roda gigi) → centang **Tampilkan berkas manifes "appsscript.json"**. Buka `appsscript.json`, ganti isinya dengan berkas **appsscript.json**.
4. Pilih fungsi `setupAppEnvironment` → **Jalankan** (cukup SEKALI; aman bila terulang). Izinkan akses. Log harus berisi "✅ Setup selesai" beserta tautan spreadsheet.
5. **Deploy → Deployment baru → Aplikasi web**: Jalankan sebagai **Saya**, Akses **Siapa saja** → Deploy → **salin URL berakhiran `/exec`**.
6. Setiap mengubah Kode.gs: **Deploy → Kelola deployment → ✏️ → Versi baru → Deploy** (URL tetap sama).

## B. Frontend (GitHub Pages)
1. Ekstrak ZIP. Folder `geoukur` di dalamnya **adalah** folder yang di-`git init` (isinya `index.html` di baris teratas).
2. Buka `js/config.js`, ganti `GANTI_DENGAN_ID_DEPLOYMENT` dengan URL `/exec` dari A5.
3. Di GitHub buat repository **Public** kosong (tanpa README). Lalu di terminal, DI DALAM folder `geoukur`:
```
dir        (Windows: harus tampak index.html)   |   ls  (Mac/Linux)
git init
git add .
git commit -m "GeoUkur pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/geoukur.git
git push -u origin main
```
(Saat diminta password, pakai *Personal Access Token* GitHub dengan scope `repo`; layar memang tidak menampilkan karakter.)
4. GitHub → **Settings → Pages** → Source: *Deploy from a branch*, Branch `main`, folder `/ (root)` → Save. Tunggu 1–2 menit.
5. Buka `https://USERNAME.github.io/geoukur/` di HP (Chrome/Safari) → menu **Tambahkan ke layar utama**.

## C. Uji
Tandai 3+ titik di peta → **Simpan Lahan** → cek baris baru di sheet `Data_Lahan` → tab **PERSIL** → ikon bagikan → buka tautan `?id=…` di perangkat lain.

## Catatan keamanan
Seluruh ID (spreadsheet) tersimpan di Script Properties, bukan di kode. URL `/exec` bukan rahasia. Karena akses "Siapa saja", siapa pun yang tahu URL API dapat menyimpan/menghapus data — jangan sebar URL `/exec`, dan jangan tambah editor proyek Apps Script sembarangan.
