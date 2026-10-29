# e-Toll Tracker Indonesia — PWA

Aplikasi web yang bisa dipasang di HP lewat Chrome. Data tersimpan di HP (localStorage), bisa dipakai tanpa internet setelah pertama kali dibuka.

## Hosting gratis di GitHub Pages (wajib HTTPS agar bisa di-instal)
1. Buat repositori baru di github.com (Public), mis. `etoll`.
2. Add file > Upload files: seret SEMUA isi folder ini (index.html, app.js, sw.js, style.css, manifest.webmanifest, folder icons) lalu Commit.
3. Settings > Pages > Source: "Deploy from a branch", Branch: main, folder: / (root) > Save.
4. Tunggu 1-2 menit; alamat: https://USERNAME.github.io/etoll/
5. Buka alamat itu di Chrome HP > menu ⋮ > "Instal aplikasi" (atau "Tambahkan ke layar utama").

## Uji di laptop
`python -m http.server 8000` lalu buka http://localhost:8000 (localhost dianggap aman, jadi bisa di-instal).

## Batasan
- Tidak bisa membaca NFC / saldo kartu e-money (browser tidak mengizinkan). Saldo dimasukkan manual.
- Gerbang & tarif: input manual. Tanpa impor resmi, GPS, atau PDF langsung (pakai Cetak > Simpan PDF).
- Data hilang jika data situs Chrome dihapus: ekspor CSV berkala.
