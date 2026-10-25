'use strict';

const $ = (id) => document.getElementById(id);

function render(url, v) {
  const out = $('out');
  out.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card ' + v.band;

  const h = document.createElement('div');
  h.className = 'h';
  h.textContent =
    v.band === 'danger' ? 'Berbahaya' :
    v.band === 'warn' ? 'Mencurigakan' : 'Tidak ada sinyal bahaya';

  const s = document.createElement('div');
  s.className = 's';
  s.textContent = url;

  card.appendChild(h);
  card.appendChild(s);

  if (v.reasons.length) {
    const ul = document.createElement('ul');
    for (const r of v.reasons) {
      const li = document.createElement('li');
      li.textContent = r;
      ul.appendChild(li);
    }
    card.appendChild(ul);
  } else {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'Tidak ada pola yang dikenal. Ini bukan jaminan aman — tetap cek lewat aplikasi resmi.';
    card.appendChild(p);
  }

  out.appendChild(card);
}

function normalize(raw) {
  let s = (raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try { return new URL(s).href; } catch (e) { return ''; }
}

function run() {
  const url = normalize($('url').value);
  const out = $('out');
  if (!url) {
    out.innerHTML = '<div class="empty">Masukkan link yang valid.</div>';
    return;
  }
  const v = CekEngine.check(url);
  render(url, v);

  // optional remote layer, if the user configured a proxy
  try {
    chrome.runtime.sendMessage({ type: 'verdict:lookup', urls: [url] }, (res) => {
      if (chrome.runtime.lastError) return;
      const host = CekEngine.hostOf(url);
      const r = res && res.results && res.results[host];
      if (r && r.threat) {
        const extra = document.createElement('div');
        extra.className = 'card danger';
        extra.innerHTML = '<div class="h">Terdaftar di database ancaman</div>' +
          '<div class="empty">' + r.threat + ' — jangan buka.</div>';
        out.appendChild(extra);
      }
    });
  } catch (e) { /* ignore */ }
}

$('check').addEventListener('click', run);
$('url').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
$('opts').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get('proxyUrl', (o) => {
  $('mode').textContent = (o.proxyUrl || '').trim() ? 'lokal + database' : 'lokal saja';
});

// convenience: if the clipboard holds a link, prefill it
if (navigator.clipboard && navigator.clipboard.readText) {
  navigator.clipboard.readText().then((t) => {
    if (/^https?:\/\//i.test((t || '').trim())) $('url').value = t.trim();
  }).catch(() => {});
} else {
  $('url').focus();
}
