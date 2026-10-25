# CekDulu

Lihat link sebelum kamu klik. Extension ringan untuk Chrome/Edge — cek URL yang muncul
di halaman, kasih verdict sebelum kamu masuk.

**~30 KB JavaScript. Tanpa analytics. Tanpa akun. Tanpa server, kecuali kamu isi sendiri.**

Open source di bawah Apache-2.0 — silakan fork, audit, dan kirim PR. Lihat [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Lihat UI-nya dulu (tanpa install)

**`demo/cekdulu-walkthrough.mp4`** — rekaman 11 detik dari extension yang benar-benar
jalan di Chrome (bukan mock-up): hover → klik → kartu blokir → kembali → link pendek.


Buka `demo/cekdulu-ui-flow.png` — empat keadaan, diambil dari kode yang benar-benar
berjalan di Chrome, bukan mock-up.

Atau coba langsung: buka `demo/f1-whatsapp.html` di browser, lalu arahkan kursor ke
link di dalam bubble chat. Halaman demo itu memuat `engine.js` + `content.js` yang sama,
jadi perilakunya identik dengan extension-nya.

---

## Install (2 menit)

1. Buka `chrome://extensions`
2. Nyalakan **Developer mode** (kanan atas)
3. Klik **Load unpacked** → pilih folder `cekdulu/`
4. Buka halaman apa pun, arahkan kursor ke sebuah link

Edge: `edge://extensions`, langkahnya sama.

---

## Yang dia lakukan

**Hover** — arahkan kursor ke link, muncul pill kecil berisi verdict + alasan.
Tidak ada yang diklik, tidak ada yang dibuka.

**Klik** — kalau skornya tinggi, klik ditahan dan muncul kartu penjelasan.
Tombol "Tetap buka" selalu ada; ini alat bantu, bukan sensor.

**Tempel link** — klik ikon extension, tempel URL yang kamu terima di WhatsApp/SMS.

**Halaman berbahaya** — kalau kamu mendarat di halaman yang skornya tinggi, muncul
banner di atas (tidak memblokir, karena false positive itu nyata).

---

## Tiga keputusan desain yang penting

### 1. CekDulu **tidak pernah membuka** URL yang dicek

Ini koreksi dari alur awal "baca URL → akses URL-nya". Membuka link untuk memeriksanya
justru berbahaya dan tidak perlu:

- **Berbahaya.** URL malware ya isinya malware. Membukanya dari browser kamu adalah persis
  yang diinginkan penyerang (drive-by download, exploit kit).
- **Membakar link.** Banyak link phishing sekali pakai, terikat IP, atau terikat user-agent.
  Kalau kamu buka duluan, penyerang tahu ada target hidup di IP itu, dan link-nya mati
  sebelum korban asli klik.
- **Bocor.** Permintaan itu membawa IP kamu.
- **Lambat.** Satu halaman punya 50–300 link. 300 fetch = halaman macet.

Menilai link cukup dari **bentuknya** + **reputasinya**. Tidak perlu masuk ke dalamnya.

### 2. Nol kerja sampai kamu menunjukkan niat

Tidak ada `MutationObserver` yang jalan terus, tidak ada scan seluruh DOM saat load.
Kerja dimulai saat `mouseover` sebuah `<a>`, dengan debounce 110 ms. Itu sebabnya
footprint-nya ~30 KB dan halaman tidak melambat.

### 3. Anggaran waktu yang keras: 140 ms

Klik tidak boleh terasa rusak. Jadi:

```
klik → cek lokal (0 ms)
     → sudah ada di cache?  → langsung jalan (< 5 ms)
     → belum?               → tahan maksimal 140 ms, lalu lanjut apa pun hasilnya
```

Kalau jawaban database datang terlambat, klik tetap jalan. Kecepatan menang atas
kelengkapan — alat yang bikin lambat akan di-uninstall.

**Tanpa proxy, extension ini tidak menyentuh klik sama sekali.** Link aman langsung jalan
seperti biasa.

---

## Verdict, bukan jaminan

| Band | Yang dilihat pengguna | Yang dilakukan |
|---|---|---|
| `ok` | "Tidak ada sinyal bahaya" | Diam saja |
| `warn` | "Mencurigakan" | Pill kuning saat hover |
| `danger` | "Berbahaya" | Tahan klik + kartu penjelasan |

Skor angka (0–100) tetap dihitung di dalam, tapi **tidak pernah ditampilkan**. Pengguna
melihat penilaian dan alasannya, bukan angka yang tidak bisa ia tafsirkan.

Skor 0 **bukan** berarti aman. Berarti "tidak ada yang saya kenali". Ini tertulis di UI-nya,
bukan cuma di README.

### Sinyal yang dipakai (semua lokal)

- Host berupa IP literal, bukan nama domain
- Punycode / karakter non-Latin (`xn--…`) — trik paling umum menyamar
- **Typosquatting** terhadap ~45 brand Indonesia (DANA, BCA, Shopee, JNE, WhatsApp, …)
- Nama brand di hostname/path padahal domainnya bukan milik brand itu
- Hosting gratis (`.my.id`, `.biz.id`, `.web.id`, `.s.id`, Vercel, Netlify, …)
- TLD berisiko (`.xyz`, `.top`, `.icu`, `.zip`, …)
- `user@` di dalam URL, port aneh, subdomain bertingkat, nama domain acak
- Link menuju file yang bisa dijalankan (`.apk`, `.exe`, …)
- Link diperpendek (ditandai, bukan dihukum)

---

## Lapisan database (opsional)

Tanpa ini extension **hanya** jalan lokal. Kalau mau lapisan reputasi:

```bash
cd worker
npx wrangler secret put SB_KEY     # API key Google Safe Browsing
npx wrangler deploy
```

Lalu tempel URL Worker-nya di **Pengaturan**. Yang dikirim hanya hostname yang belum ada
di cache; hasil disimpan 6 jam.

Kenapa butuh proxy: API key di dalam bundle extension itu publik — siapa pun bisa
mengekstrak dan menghabiskannya. Worker menyimpannya di server.

**Catatan penting:**
- Google Safe Browsing **gratis hanya untuk non-komersial**. Project ini non-komersial,
  jadi aman. Kalau nanti dijual, harus pindah ke Web Risk ($0.50/1.000 lookup setelah
  100.000 gratis/bulan).
- API v4 **berhenti didukung 31 Maret 2027**. Sebelum itu port `lookup()` ke v5 `urls.search`.
- URL Worker kamu itu seperti password — aktifkan rate limiting di Cloudflare.

---

## Batas yang perlu kamu tahu (jujur)

- **Hanya link `<a>`.** Tidak menangkap `window.open()` dari JavaScript, submit form,
  tombol SPA, atau link di dalam gambar/screenshot.
- **Hanya browser.** Link di WhatsApp tetap tidak terjangkau — itu butuh
  `AccessibilityService` di Android, yang diblokir Google sejak Android 17.
- **Bukan pengganti Chrome Safe Browsing.** Chrome sudah punya database yang jauh lebih
  besar. Nilai tambah di sini: alasan yang bisa dibaca manusia, deteksi typosquat brand
  Indonesia, dan peringatan sebelum klik — bukan sesudah halaman terbuka.
- **False positive itu nyata.** "Tetap buka" selalu tersedia. Jangan pernah jadikan ini
  satu-satunya lapisan keamanan.

---

## Struktur

```
cekdulu/
├── manifest.json          MV3
├── src/engine.js          semua logika penilaian, nol network
├── src/content.js         hover pill, click guard, banner
├── src/background.js      cache 6 jam + panggilan proxy opsional
├── popup.html/js          tempel-link checker
├── options.html/js        pengaturan proxy
├── worker/worker.js       Cloudflare Worker (Safe Browsing proxy)
└── icons/
```

## Langkah berikutnya (belum dikerjakan)

- [ ] Auto-scan link yang terlihat, pakai `IntersectionObserver` + batas 20 link
- [ ] Migrasi ke Safe Browsing v5 `hashes.search` — URL tidak dikirim dalam bentuk polos
- [ ] Whitelist domain yang kamu percaya
- [ ] Terjemahan Inggris
- [ ] Publish ke Chrome Web Store + Firefox AMO (butuh review `<all_urls>`)

---

## Tes

```bash
npm install
npm test        # 12 tes perilaku di jsdom
npm run check   # syntax check semua file
```

Tes menguji **kontrak perilaku**, bukan "apakah tampilannya muncul":

1. tanpa database, klik pada link aman tidak boleh disentuh sama sekali
2. link yang diketahui berbahaya harus ditahan dan kartunya muncul
3. link tak dikenal harus tetap lanjut setelah batas waktu habis

## Kontribusi

Kontribusi paling berguna tidak butuh coding: **menambah brand Indonesia** dan **mengirim
contoh URL untuk set uji berlabel**. Detailnya di [CONTRIBUTING.md](CONTRIBUTING.md).

Ada empat aturan yang tidak bisa ditawar: jangan pernah membuka URL yang dinilai, jangan
menambah telemetri, jangan menampilkan kata "aman", jangan menaruh rahasia di bundle.

## Keamanan

Jangan laporkan celah lewat issue publik — pakai
[Security Advisories](https://github.com/khalifaardi/cekdulu/security/advisories/new).
Lihat [SECURITY.md](SECURITY.md) untuk cakupannya.

## Build resmi

Ini project keamanan, jadi fork adalah risiko: siapa pun bisa mengambil kode ini, menambah
keylogger, dan menerbitkannya dengan nama mirip.

- Build resmi hanya dari repo ini, atau dari Chrome Web Store / Firefox AMO yang ditautkan
  di halaman Releases.
- Nama **CekDulu** dan ikonnya tidak termasuk dalam lisensi (Apache-2.0 pasal 6). Fork boleh
  memakai kodenya, tapi harus memakai nama lain.
- Sebelum memasang build dari mana pun: buka `chrome://extensions`, cek jumlah file dan
  izin yang diminta. Extension ini hanya butuh `storage` dan host access.

## Lisensi

[Apache License 2.0](LICENSE). Pasal 5 mengatur kontribusi masuk secara otomatis — tidak ada
CLA yang perlu ditandatangani.
