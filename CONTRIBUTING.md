# Contributing to CekDulu

Terima kasih sudah mau ikut. Project ini kecil dan dijaga sederhana — itu disengaja,
supaya orang bisa membaca seluruh kodenya dalam satu duduk.

English is fine too. Issues and PRs in either language are welcome.

---

## Cara paling berguna untuk membantu (tanpa menulis kode)

**1. Tambah brand Indonesia ke daftar.**
`src/engine.js` punya array `BRANDS` berisi nama dan domain resmi. Ini yang membuat
`bca-login.my.id` bisa dikenali sebagai penyamaran. Daftarnya masih ~45 entri dan
seharusnya jauh lebih banyak: bank daerah, BPR, koperasi, marketplace, operator seluler,
penyelenggara pinjaman resmi, rumah sakit, kampus, layanan pemerintah.

Bentuk entrinya:

```js
['nama-brand', ['domain-resmi-1', 'domain-resmi-2']],
```

Aturannya: huruf kecil, **domain resmi saja** (bukan halaman promo), dan harus benar-benar
milik brand tersebut. Satu brand per baris, urutan abjad.

**2. Kirim contoh URL untuk test set.**
Kami sedang membangun set uji berlabel: URL phishing yang sudah dikonfirmasi, dan URL sah
yang populer di Indonesia. Tanpa ini, akurasi tidak bisa diukur. Kalau kamu punya contoh
(boleh dari laporan publik, IDADX, atau pesan yang kamu terima sendiri — **sensor data
pribadinya**), buka issue dengan label `test-set`.

**3. Terjemahan.** UI saat ini Bahasa Indonesia. Versi Inggris belum ada.

**4. Laporkan false positive.** Kalau sebuah situs sah diberi label "Berbahaya", itu bug
serius — lebih serius daripada melewatkan satu phishing, karena bikin orang uninstall.
Sertakan URL-nya dan alasan yang muncul di pill.

---

## Menyiapkan environment

```bash
git clone https://github.com/khalifaardi/cekdulu.git
cd cekdulu
npm install
npm test          # 12 tes, harus lulus semua
npm run check     # syntax check semua file JS
```

Memuat extension-nya:

1. `chrome://extensions`
2. Nyalakan **Developer mode**
3. **Load unpacked** → pilih folder repo ini

Halaman demo ada di `demo/` dan memuat `src/engine.js` + `src/content.js` yang sama, jadi
kamu bisa menguji perubahan tanpa memuat ulang extension.

---

## Aturan yang tidak bisa ditawar

Empat hal ini adalah alasan project ini ada. PR yang melanggarnya akan ditolak, sebaik
apa pun hasilnya.

1. **Jangan pernah membuka URL yang sedang dinilai.** Membuka link untuk "memeriksanya"
   justru mengeksekusi serangan, membakar link sekali pakai, dan membocorkan IP pengguna.
   Penilaian hanya dari bentuk URL dan reputasi.
2. **Jangan menambah telemetri, analytics, atau panggilan jaringan default.** Extension
   harus berfungsi penuh secara offline dan tanpa akun.
3. **Jangan menampilkan "aman".** Skor 0 berarti "tidak ada sinyal yang dikenal". Selalu
   ada jalan untuk melanjutkan; ini alat bantu, bukan sensor.
4. **Jangan menaruh rahasia di bundle.** Semua isi extension itu publik. API key hanya
   boleh hidup di proxy (`worker/`).

## Aturan untuk perubahan engine

Setiap perubahan pada `src/engine.js` harus disertai tes:

- URL sah yang tidak boleh berubah jadi flag → tambahkan ke test "official domains score zero"
- Pola baru → tambahkan tes yang gagal sebelum perubahan dan lulus sesudahnya

Jalankan `npm test` sebelum membuka PR. PR tanpa tes untuk perubahan logika akan diminta
menambah tes dulu.

## Gaya kode

- JavaScript biasa, tanpa framework, tanpa build step. Target: seluruh extension < 100 KB.
- Tidak ada dependency runtime. `jsdom` hanya untuk tes.
- Komentar menjelaskan **kenapa**, bukan apa.
- Nama fungsi dan variabel dalam bahasa Inggris; teks yang dilihat pengguna dalam Bahasa
  Indonesia.

## Commit dan PR

- Commit message singkat, kalimat perintah: `add BPR banks to brand list`.
- Satu PR satu hal.
- Sertakan `git commit -s` (DCO). Dengan menandatangani, kamu menyatakan kamu berhak
  menyumbangkan kode itu. Tidak ada CLA — lisensi Apache-2.0 sudah mengatur kontribusi
  masuk secara otomatis (pasal 5).

## Lisensi kontribusi

Dengan mengirim PR, kamu setuju kontribusimu dilisensikan di bawah Apache License 2.0,
tanpa syarat tambahan.

## Pertanyaan

Buka issue dengan label `question`, atau mulai diskusi di tab Discussions.
