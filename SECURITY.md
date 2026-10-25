# Security Policy

CekDulu adalah alat keamanan. Kalau ada celah di dalamnya, penggunanya justru berada di
posisi yang lebih berbahaya daripada tanpa extension sama sekali. Karena itu laporan
kerentanan diperlakukan serius.

## Melaporkan

**Jangan buka issue publik.** Gunakan GitHub Security Advisories:

> https://github.com/khalifaardi/safe-from-dangerous-url/security/advisories/new

Kalau itu tidak bisa diakses, kirim email ke alamat di profil GitHub pemilik repo.

Sertakan: versi, browser, langkah reproduksi, dan dampaknya. Proof of concept membantu,
tapi jangan menyertakan data pribadi orang lain.

**Respons:** konfirmasi dalam 7 hari, perbaikan untuk isu berat dalam 30 hari bila
memungkinkan. Pelapor akan disebut di catatan rilis kecuali minta anonim.

## Yang dianggap kerentanan

- **Bypass kartu blokir.** Cara apa pun membuat link `danger` terbuka tanpa interaksi
  pengguna, atau membuat indikator visual tidak muncul.
- **XSS / HTML injection** lewat URL, `alt` text, atau isi pesan ke dalam pill, kartu, atau
  banner. Semua teks dirender lewat `textContent`; kalau ada jalur yang tidak, itu bug.
- **Kebocoran data.** URL, judul halaman, atau riwayat keluar dari perangkat tanpa
  sepengetahuan pengguna, atau tersimpan di cache dengan data pribadi.
- **Penyalahgunaan izin.** Content script jalan di halaman yang seharusnya tidak disentuh,
  atau mengubah DOM di luar UI-nya sendiri.
- **Masalah rantai pasok.** Dependency yang bisa diambil alih, artefak rilis yang tidak
  cocok dengan source, atau instruksi build yang menghasilkan bundle berbeda.

## Yang bukan kerentanan

- False positive pada situs sah → itu bug akurasi, buka issue biasa dengan label `accuracy`.
- Phishing yang lolos → juga bug akurasi, bukan celah keamanan.
- Chrome menampilkan peringatan izin "Read and change all your data on all websites" —
  itu konsekuensi dari memindai link di semua halaman, dan sudah dijelaskan di README.

## Batasan yang diketahui

Ini bukan celah, tapi perlu diketahui:

- Link yang dinavigasi lewat JavaScript (`window.open`, form submit, router SPA) tidak
  tertangkap. Cakupan klik nyata di bawah 100%.
- Middle-click dan Ctrl/Shift+click tidak diintersep.
- Extension tidak bisa membaca layar aplikasi lain (WhatsApp, SMS). Itu batas platform,
  bukan bug.

## Catatan untuk pengguna

Extension ini adalah lapisan bantu, bukan pengganti keamanan. Jangan pernah
mengandalkannya sebagai satu-satunya pertahanan.
