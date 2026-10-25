#!/usr/bin/env python3
"""Builds the demo pages used for the UI-flow screenshots.

Each page embeds the REAL engine.js + content.js so what you see is the actual
extension behaviour, not a mock-up.
"""
import pathlib

ROOT = pathlib.Path("/home/ubuntu/projects/cekdulu")
OUT = ROOT / "demo"
OUT.mkdir(exist_ok=True)

engine = (ROOT / "src/engine.js").read_text()
content = (ROOT / "src/content.js").read_text()

STUB = """
<script>
  window.chrome = {
    storage: { local: { get: (k, cb) => cb && cb({}), set: () => {} },
               session: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
    runtime: { sendMessage: (m, cb) => cb && cb({ ok: true, results: {} }) }
  };
  window.CHROME_STUB = true;
</script>
"""

# ---------------------------------------------------------------- WhatsApp --
wa = """<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>WhatsApp</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; height:100vh; display:flex; font: 14px/1.45 "Segoe UI", Roboto, sans-serif;
         background:#0b141a; color:#e9edef; overflow:hidden; }
  .side { width: 330px; background:#111b21; border-right:1px solid #222d34; display:flex; flex-direction:column; }
  .side .top { height:58px; display:flex; align-items:center; gap:12px; padding:0 16px; background:#202c33; }
  .avatar { width:32px;height:32px;border-radius:50%;background:#2a3942; flex:0 0 auto; }
  .search { margin:10px; padding:8px 12px; background:#202c33; border-radius:8px; color:#8696a0; font-size:13px; }
  .chatrow { display:flex; gap:12px; padding:11px 14px; align-items:center; }
  .chatrow.on { background:#2a3942; }
  .chatrow .t { flex:1; min-width:0; }
  .chatrow .n { font-size:14.5px; }
  .chatrow .p { font-size:12.5px; color:#8696a0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .badge { background:#00a884; color:#111b21; font-size:11px; font-weight:700; border-radius:10px; padding:1px 6px; }
  .main { flex:1; display:flex; flex-direction:column; background:#0b141a;
          background-image: radial-gradient(#111b21 1px, transparent 1px); background-size:22px 22px; }
  .main .top { height:58px; display:flex; align-items:center; gap:12px; padding:0 16px; background:#202c33; }
  .main .top .n { font-size:14.5px; }
  .main .top .s { font-size:12px; color:#8696a0; }
  .feed { flex:1; padding:22px 60px; display:flex; flex-direction:column; gap:10px; }
  .chip { align-self:center; background:#182229; color:#8696a0; font-size:11.5px;
          padding:5px 12px; border-radius:7px; margin-bottom:6px; }
  .msg { max-width: 62%; background:#202c33; padding:7px 9px 8px; border-radius:8px;
         font-size:14px; box-shadow:0 1px 1px rgba(0,0,0,.25); position:relative; }
  .msg.out { align-self:flex-end; background:#005c4b; }
  .msg .meta { display:block; text-align:right; font-size:11px; color:#8696a0; margin-top:3px; }
  .msg .sender { display:block; font-size:12.5px; color:#53bdeb; margin-bottom:2px; }
  a.lnk { color:#53bdeb; text-decoration:none; border-bottom:1px solid rgba(83,189,235,.35); }
  .composer { height:62px; background:#202c33; margin:0 14px 14px; border-radius:8px;
              display:flex; align-items:center; padding:0 14px; color:#8696a0; font-size:13.5px; }
</style></head><body>
<div class="side">
  <div class="top"><div class="avatar"></div><div style="flex:1"></div><div class="avatar" style="width:22px;height:22px"></div></div>
  <div class="search">Cari atau mulai chat baru</div>
  <div class="chatrow on"><div class="avatar"></div><div class="t"><div class="n">+62 812-8890-4471</div><div class="p">Akun Anda akan diblokir, segera…</div></div><span class="badge">2</span></div>
  <div class="chatrow"><div class="avatar"></div><div class="t"><div class="n">Keluarga Besar</div><div class="p">Ibu: sudah makan belum?</div></div><span class="badge">5</span></div>
  <div class="chatrow"><div class="avatar"></div><div class="t"><div class="n">JNE — Info Paket</div><div class="p">Paket Anda tertahan di gudang</div></div></div>
  <div class="chatrow"><div class="avatar"></div><div class="t"><div class="n">Budi Santoso</div><div class="p">ok nanti aku transfer</div></div></div>
</div>
<div class="main">
  <div class="top"><div class="avatar"></div><div><div class="n">+62 812-8890-4471</div><div class="s">online</div></div></div>
  <div class="feed">
    <div class="chip">HARI INI</div>
    <div class="msg"><span class="sender">+62 812-8890-4471</span>
      Selamat! Nomor Anda terpilih mendapatkan saldo DANA Rp 1.500.000.
      Klaim sebelum pukul 23.59 hari ini.
      <span class="meta">19:42</span></div>
    <div class="msg">
      Silakan verifikasi di sini:
      <a class="lnk" id="target" href="https://bca-verifikasi-akun.my.id/klaim">https://bca-verifikasi-akun.my.id/klaim</a>
      <span class="meta">19:42</span></div>
    <div class="msg out">Ini beneran dari bank?<span class="meta">19:44 ✓✓</span></div>
    <div class="msg out">Eh coba cek juga ini
      <a class="lnk" id="target2" href="https://bit.ly/3xYz">https://bit.ly/3xYz</a>
      <span class="meta">19:45 ✓✓</span></div>
    <div class="msg"><span class="sender">+62 812-8890-4471</span>
      Iya resmi. Jangan sampai hangus ya kak.
      <span class="meta">19:44</span></div>
  </div>
  <div class="composer">Ketik pesan</div>
</div>
""" + STUB + "<script>" + engine + "</script><script>" + content + "</script></body></html>"


# ------------------------------------------------------------------ article --
article = """<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Panduan Klaim Subsidi</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; background:#ffffff; color:#12141a; font: 16px/1.7 Georgia, "Times New Roman", serif; }
  .bar { height:56px; background:#0f2a4a; display:flex; align-items:center; padding:0 26px; gap:22px;
         font-family: "Segoe UI", Roboto, sans-serif; }
  .logo { color:#fff; font-weight:800; letter-spacing:.4px; font-size:15px; }
  .nav { color:#a8c2e0; font-size:13px; }
  .wrap { max-width: 720px; margin: 34px auto 0; padding: 0 22px; }
  h1 { font-size: 30px; line-height:1.25; margin: 0 0 8px; font-family:"Segoe UI",Roboto,sans-serif; }
  .byline { color:#5b6472; font-size:13px; font-family:"Segoe UI",Roboto,sans-serif;
            border-bottom:1px solid #e3e6ea; padding-bottom:14px; margin-bottom:22px; }
  p { margin: 0 0 18px; }
  a { color:#1a56b8; }
  .box { background:#f4f7fb; border-left:3px solid #1a56b8; padding:14px 16px; font-size:15px;
         font-family:"Segoe UI",Roboto,sans-serif; margin: 22px 0; }
</style></head><body>
<div class="bar"><div class="logo">WARTA EKONOMI</div><div class="nav">Ekonomi</div><div class="nav">Keuangan</div><div class="nav">Teknologi</div></div>
<div class="wrap">
  <h1>Pemerintah Perluas Program Bantuan, Pendaftaran Dibuka Mulai Pekan Depan</h1>
  <div class="byline">Redaksi · 24 Oktober 2026 · 4 menit baca</div>
  <p>Program bantuan yang menyasar pelaku usaha mikro kembali diperluas tahun ini. Pendaftaran
     dilakukan sepenuhnya secara daring melalui portal resmi yang disediakan kementerian.</p>
  <p>Masyarakat diimbau berhati-hati terhadap situs penipuan yang mengatasnamakan program ini.
     Beberapa laporan menyebut adanya halaman palsu yang meminta data rekening dan kode OTP.
     Informasi resmi hanya dapat diakses melalui
     <a id="target" href="https://klaim.bantuan-pemerintah.resmi-online.web.id/daftar">portal pendaftaran</a>
     yang tautannya diumumkan di situs kementerian.</p>
  <div class="box">Pendaftaran tidak dipungut biaya apa pun. Laporkan tautan mencurigakan
     ke Indonesia Anti-Scam Centre melalui iasc.ojk.go.id.</div>
  <p>Kuota tahap pertama dibatasi 50.000 penerima. Verifikasi dokumen dilakukan dalam
     waktu tujuh hari kerja setelah pendaftaran diterima.</p>
</div>
""" + STUB + "<script>" + engine + "</script><script>" + content + "</script></body></html>"


# ------------------------------------------------------------------- popup ---
popup = """<!doctype html><html lang="id"><head><meta charset="utf-8"><title>CekDulu</title>
""" + STUB + """
<style>
  :root { color-scheme: dark; }
  body { margin:0; width:340px; background:#16171a; color:#e9eaee;
         font:13px/1.5 -apple-system,"Segoe UI",Roboto,sans-serif; padding:14px; }
  h1 { font-size:14px; margin:0 0 2px; }
  .tag { color:#9aa0aa; font-size:11px; margin-bottom:12px; }
  input { width:100%; box-sizing:border-box; padding:9px 10px; border-radius:8px;
          border:1px solid #2e3138; background:#0f1012; color:#eceef2; font:inherit; }
  button { margin-top:8px; width:100%; padding:9px; border-radius:8px; cursor:pointer;
           border:1px solid #2e3138; background:#22252a; color:#e9eaee; font:inherit; font-weight:600; }
  #out { margin-top:12px; }
  .card { border-radius:9px; padding:10px 11px; margin-bottom:9px; }
  .card.ok { background:#10291d; border:1px solid #1c4a33; }
  .card.warn { background:#2c2109; border:1px solid #5a4210; }
  .card.danger { background:#2d1010; border:1px solid #5e1c1c; }
  .card .h { font-weight:700; margin-bottom:4px; }
  .card .s { font-family:ui-monospace,Menlo,monospace; font-size:11px; opacity:.75;
             word-break:break-all; margin-bottom:6px; }
  ul { margin:0; padding-left:16px; } li { margin-bottom:3px; }
  .empty { color:#7f858f; font-size:12px; }
  .foot { margin-top:12px; font-size:11px; color:#7f858f; display:flex; justify-content:space-between; }
  a { color:#6ea0f0; text-decoration:none; }
</style></head><body>
  <h1>CekDulu</h1>
  <div class="tag">Tempel link yang kamu terima, sebelum diklik.</div>
  <input id="url" type="text" value="https://dana-klaim-hadiah.xyz/verifikasi" autocomplete="off" spellcheck="false">
  <button id="check">Cek link</button>
  <div id="out"></div>
  <div class="foot"><span id="mode">lokal saja</span><a href="#">Pengaturan</a></div>
  <script src="../src/engine.js"></script>
  <script src="../popup.js"></script>
  <script>
    // demo: auto-run the check so the screenshot shows a result
    window.addEventListener('load', () => setTimeout(() => document.getElementById('check').click(), 120));
  </script>
</body></html>"""

(OUT / "f1-whatsapp.html").write_text(wa)
(OUT / "f2-article.html").write_text(article)
(OUT / "f3-popup.html").write_text(popup)

for p in sorted(OUT.iterdir()):
    print(p.name, round(p.stat().st_size / 1024, 1), "KB")
