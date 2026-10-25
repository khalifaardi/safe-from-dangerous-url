## What this PR does

<!-- Satu paragraf. Kalau ini perubahan aturan deteksi, sebutkan URL yang berubah verdict-nya. -->

## Checklist

- [ ] `npm test` lulus (12 tes)
- [ ] `npm run check` lulus
- [ ] Perubahan di `src/engine.js` disertai tes baru
- [ ] Tidak menambah dependency runtime
- [ ] Tidak menambah panggilan jaringan default / telemetri
- [ ] Tidak pernah membuka URL yang sedang dinilai
- [ ] Tidak menampilkan kata "aman"
- [ ] Tidak ada rahasia/API key di bundle

## Dampak

<!-- Pilih satu: menambah deteksi / mengurangi false positive / UI / dokumentasi / lain-lain -->

- Sebelum:
- Sesudah:
