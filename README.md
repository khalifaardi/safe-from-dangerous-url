# CekDulu

Cek link sebelum kamu klik. Arahkan kursor ke sebuah tautan, dan sebelum kamu sempat
menekannya, CekDulu sudah bilang link itu mencurigakan atau tidak — beserta alasannya.

Ekstensi Chrome/Edge, ~30 KB JavaScript. Tanpa analytics, tanpa akun, tanpa server —
kecuali kamu pasang sendiri.

Open source di bawah Apache-2.0: silakan fork, audit, dan kirim PR. Aturan mainnya ada di
[CONTRIBUTING.md](CONTRIBUTING.md).

## Coba dulu, tanpa memasang apa pun

`demo/cekdulu-walkthrough.mp4` — rekaman 11 detik ekstensi yang benar-benar jalan di
Chrome, bukan mock-up: kursor berhenti → klik → kartu blokir → kembali → link pendek.

`demo/cekdulu-ui-flow.png` menampilkan empat keadaan, diambil dari kode yang berjalan di
Chrome.

Atau coba langsung: buka `demo/f1-whatsapp.html` di browser, lalu arahkan kursor ke link
di dalam bubble chat. Halaman demo itu memuat `engine.js` dan `content.js` yang sama,
jadi perilakunya identik dengan ekstensinya.

## Pasang (2 menit)

1. Buka `chrome://extensions`
2. Nyalakan **Developer mode** (kanan atas)
3. Klik **Load unpacked**, pilih folder `cekdulu/`
4. Buka halaman apa pun, arahkan kursor ke sebuah link

Di Edge: `edge://extensions`, langkahnya sama.

## Cara kerjanya

**Kursor berhenti di link.** Muncul label kecil berisi penilaian dan alasannya. Tidak ada
yang diklik, tidak ada yang dibuka.

**Kamu mengklik.** Kalau skornya tinggi, klik ditahan dan muncul kartu penjelasan. Tombol
"Tetap buka" selalu ada — ini alat bantu, bukan sensor.

**Kamu menempel link.** Klik ikon ekstensi, tempel URL yang kamu terima di WhatsApp atau
SMS.

**Kamu mendarat di halaman berisiko.** Muncul pita peringatan di atas halaman. Tidak
memblokir, karena positif palsu itu memang terjadi.

## Tiga keputusan desain

### 1. CekDulu tidak pernah membuka URL yang dicek

Alur awalnya salah: baca URL, lalu buka URL-nya untuk diperiksa. Membuka link justru
berbahaya dan tidak perlu.

- **Berbahaya.** URL malware isinya malware. Membukanya dari browser kamu adalah persis
  yang diinginkan penyerang (drive-by download, exploit kit).
- **Membakar link.** Banyak link phishing sekali pakai, terikat IP atau user-agent. Kalau
  kamu buka duluan, penyerang tahu ada target hidup di IP itu, dan link-nya mati sebelum
  korban asli sempat klik.
- **Membocorkan identitas.** Permintaan itu membawa IP kamu.
- **Lambat.** Satu halaman punya 50–300 link. 300 fetch berarti halaman macet.

Menilai link cukup dari bentuknya dan reputasinya. Tidak perlu masuk ke dalamnya.

### 2. Tidak ada kerja sampai kamu menunjukkan niat

Tidak ada `MutationObserver` yang jalan terus, tidak ada pemindaian seluruh DOM saat
halaman dimuat. Kerja baru dimulai saat `mouseover` sebuah `<a>`, dengan debounce 110 ms.
Itu sebabnya jejaknya cuma ~30 KB dan halaman tidak melambat.

### 3. Batas keras 140 ms

Klik yang tertahan lama terasa seperti browser rusak. Jadi:

```
klik → cek lokal (0 ms)
     → sudah ada di cache?  → langsung jalan (< 5 ms)
     → belum?               → tahan maksimal 140 ms, lalu lanjut apa pun hasilnya
```

Kalau jawaban database datang terlambat, klik tetap jalan. Kecepatan didahulukan di atas
kelengkapan, karena alat yang bikin lambat akan dicopot orang.

**Tanpa proxy, ekstensi ini tidak menyentuh klik sama sekali.** Link aman langsung jalan
seperti biasa.

## Yang kamu lihat: penilaian, bukan jaminan

| Tingkat | Yang kamu lihat | Yang terjadi |
|---|---|---|
| `ok` | "Tidak ada sinyal bahaya" | Diam saja |
| `warn` | "Mencurigakan" | Label kuning saat kursor berhenti |
| `danger` | "Berbahaya" | Klik ditahan + kartu penjelasan |

Skor angka (0–100) tetap dihitung di dalam, tapi tidak pernah ditampilkan. Kamu melihat
penilaian dan alasannya, bukan angka yang tidak bisa kamu tafsirkan.

Skor 0 **bukan** berarti aman. Artinya "tidak ada yang saya kenali". Ini tertulis di UI-nya,
bukan cuma di README.

### Sinyal yang dipakai (semua lokal)

- Host berupa IP literal, bukan nama domain
- Punycode / karakter non-Latin (`xn--…`) — trik paling umum untuk menyamar
- **Typosquatting** terhadap ~45 brand Indonesia (DANA, BCA, Shopee, JNE, WhatsApp, …)
- Nama brand di hostname atau path, padahal domainnya bukan milik brand itu
- Hosting gratis (`.my.id`, `.biz.id`, `.web.id`, `.s.id`, Vercel, Netlify, …)
- TLD berisiko (`.xyz`, `.top`, `.icu`, `.zip`, …)
- `user@` di dalam URL, port aneh, subdomain bertingkat, nama domain acak
- Link menuju file yang bisa dijalankan (`.apk`, `.exe`, …)
- Link diperpendek (ditandai, bukan dihukum)

## Lapisan database (opsional)

Tanpa lapisan ini, ekstensi hanya jalan lokal. Kalau mau menambah reputasi:

```bash
cd worker
npx wrangler secret put SB_KEY     # API key Google Safe Browsing
npx wrangler deploy
```

Lalu tempel URL Worker-nya di **Pengaturan**. Yang dikirim hanya hostname yang belum ada di
cache; hasilnya disimpan 6 jam.

Kenapa harus lewat proxy: API key di dalam bundle ekstensi itu publik, siapa pun bisa
mengekstraknya dan menghabiskannya. Worker menyimpannya di server.

Yang perlu kamu tahu:

- Dua endpoint v5 itu beda tugas, jangan tertukar. `urls:search` menggantikan
  `threatMatches:find` (kirim URL, terima penilaian), sedangkan `hashes:search` menggantikan
  `fullHashes.find` (kirim prefix hash). Proyek ini sekarang memakai jalur pertama; jalur
  kedua ada di daftar berikutnya karena lebih privat.

- Google Safe Browsing gratis hanya untuk non-komersial. Proyek ini non-komersial, jadi
  masih masuk. Kalau nanti dijual, harus pindah ke Web Risk ($0.50/1.000 lookup setelah
  100.000 gratis per bulan).
- `worker/worker.js` masih memanggil `v4/threatMatches:find`, dan v4 berhenti 31 Maret
  2027. Pengganti langsungnya `v5/urls:search`: tetap mengirim URL polos, maksimal 50 per
  request, dan balasannya membawa `cacheDuration` yang wajib dipakai.
- URL Worker kamu itu seperti password — aktifkan rate limiting di Cloudflare.

## Yang belum bisa dilakukannya

- **Hanya link `<a>`.** Tidak menangkap `window.open()` dari JavaScript, submit form,
  tombol SPA, atau link di dalam gambar dan screenshot.
- **Hanya di browser.** Link di WhatsApp tetap tidak terjangkau. Itu butuh
  `AccessibilityService` di Android, yang diblokir Google sejak Android 17.
- **Bukan pengganti Chrome Safe Browsing.** Chrome sudah punya database yang jauh lebih
  besar. Nilai tambah di sini: alasan yang bisa dibaca manusia, deteksi typosquat brand
  Indonesia, dan peringatan sebelum klik — bukan sesudah halaman terbuka.
- **Positif palsu itu nyata.** "Tetap buka" selalu tersedia. Jangan jadikan ini
  satu-satunya lapisan keamanan.

## Isi folder

```
cekdulu/
├── manifest.json          MV3
├── src/engine.js          semua logika penilaian, nol network
├── src/content.js         label saat kursor berhenti, penahan klik, pita peringatan
├── src/background.js      cache 6 jam + panggilan proxy opsional
├── popup.html/js          pemeriksa link tempel
├── options.html/js        pengaturan proxy
├── worker/worker.js       Cloudflare Worker (proxy Safe Browsing)
└── icons/
```

## Yang belum dikerjakan

- [ ] Pindai otomatis link yang terlihat, pakai `IntersectionObserver` dengan batas 20 link
- [ ] Pindah ke v5 `hashes.search` — hash URL di lokal, yang dikirim cuma prefix 4 byte,
      jadi URL tidak pernah dikirim polos
- [ ] Daftar domain yang kamu percayai
- [ ] Terjemahan bahasa Inggris
- [ ] Rilis ke Chrome Web Store dan Firefox AMO (butuh review `<all_urls>`)

## Uji

```bash
npm install
npm test        # 12 tes perilaku di jsdom
npm run check   # cek sintaks semua file
```

Tes menguji **kontrak perilaku**, bukan "apakah tampilannya muncul":

1. tanpa database, klik pada link aman tidak boleh disentuh sama sekali
2. link yang diketahui berbahaya harus ditahan dan kartunya muncul
3. link tak dikenal harus tetap lanjut setelah batas waktu habis

## Ikut menyumbang

Sumbangan paling berguna tidak perlu menulis kode: **menambah brand Indonesia** dan
**mengirim contoh URL untuk set uji berlabel**. Detailnya di [CONTRIBUTING.md](CONTRIBUTING.md).

Empat hal yang tidak boleh dilanggar: jangan pernah membuka URL yang dinilai, jangan
menambah telemetri, jangan menampilkan kata "aman", jangan menaruh rahasia di dalam bundle.

## Melaporkan celah

Jangan laporkan lewat issue publik. Pakai
[Security Advisories](https://github.com/khalifaardi/safe-from-dangerous-url/security/advisories/new).
Cakupannya ada di [SECURITY.md](SECURITY.md).

## Rilis resmi

Ini proyek keamanan, jadi fork memang berisiko: siapa pun bisa mengambil kode ini, menambah
keylogger, lalu menerbitkannya dengan nama yang mirip.

- Rilis resmi hanya dari repo ini, atau dari Chrome Web Store / Firefox AMO yang tertaut di
  halaman Releases.
- Nama **CekDulu** dan ikonnya di luar cakupan lisensi (Apache-2.0 pasal 6). Fork boleh
  memakai kodenya, tapi harus memakai nama lain.
- Sebelum memasang rilis dari sumber mana pun: buka `chrome://extensions`, cek jumlah file
  dan izin yang diminta. Ekstensi ini hanya meminta `storage` dan host access.

## Lisensi

[Apache License 2.0](LICENSE). Pasal 5 mengatur kontribusi masuk secara otomatis — tidak ada
CLA yang perlu ditandatangani.
