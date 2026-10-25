# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/), versi mengikuti
[SemVer](https://semver.org/lang/id/).

## [Unreleased]

### Planned
- Set uji berlabel (100 URL phishing + 100 domain sah) sebagai dasar pengukuran akurasi
- Sinyal umur domain lewat RDAP — tanpa membuka halaman
- Whitelist domain populer untuk menekan false positive
- Decode punycode + peta homoglyph, menggantikan penalti `xn--` menyeluruh
- PWA share target (CekDulu di luar browser, Android)

## [0.1.0] — 2026-10-25

### Added
- Extension MV3: pill saat hover, kartu blokir saat klik, banner untuk halaman berbahaya
- Popup untuk memeriksa link yang ditempel
- Engine lokal: typosquatting, penyamaran brand, punycode, hosting gratis, TLD berisiko,
  `user@`, file yang bisa dieksekusi, subdomain bertingkat
- Proxy Cloudflare Worker opsional untuk Google Safe Browsing
- Cache verdict per domain, 6 jam
- 12 tes perilaku (jsdom) + 17 kasus engine
- Halaman demo dan rekaman walkthrough

### Known limitations
- Tidak menangkap navigasi lewat JavaScript, form submit, atau router SPA
- Middle-click dan Ctrl/Shift+click tidak diintersep
- Tidak bisa membaca layar aplikasi lain
