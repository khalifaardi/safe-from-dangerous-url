/* CekDulu — content script.
 *
 * Design rules this file obeys:
 *   1. Never load the URL being checked. Judging a link must not mean visiting it.
 *   2. Do no work until the user shows intent (hover) or acts (click).
 *   3. Every network-ish step has a hard time budget. Fast beats thorough.
 */
'use strict';

const REMOTE_BUDGET_MS = 140;   // max time we delay a click
const HOVER_DEBOUNCE_MS = 110;  // hover intent, not hover noise

let shadow = null;
let pill = null;
let hoverTimer = null;
let lastHoverUrl = '';
const remoteVerdicts = new Map(); // host -> threat type
let remoteEnabled = false;       // false = zero interference, nothing leaves the device

try {
  chrome.storage.local.get('proxyUrl', (o) => {
    remoteEnabled = !!String(o.proxyUrl || '').trim();
  });
} catch (e) { /* extension context gone */ }

/* ------------------------------------------------------------------ UI --- */

function ensureUI() {
  if (shadow) return shadow;
  const host = document.createElement('div');
  host.id = '__cekdulu_host__';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;pointer-events:none;';
  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .pill {
        position: fixed; max-width: 320px; padding: 7px 10px; border-radius: 8px;
        font: 12px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif;
        color: #fff; box-shadow: 0 4px 18px rgba(0,0,0,.28);
        pointer-events: none; opacity: 0; transform: translateY(4px);
        transition: opacity .08s ease, transform .08s ease;
      }
      .pill.show { opacity: 1; transform: translateY(0); }
      .ok    { background: #12603a; }
      .warn  { background: #8a5a00; }
      .danger{ background: #8c1d1d; }
      .t { font-weight: 600; display: block; margin-bottom: 2px; }
      .r { opacity: .92; }
      .host { font-family: ui-monospace, Menlo, monospace; font-size: 11px; opacity: .85; }
      .overlay {
        position: fixed; inset: 0; background: rgba(10,10,12,.72);
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto; z-index: 2147483647;
      }
      .card {
        background: #16171a; color: #f2f2f3; width: min(430px, 92vw);
        border-radius: 14px; padding: 20px 20px 16px; border: 1px solid #2a2c31;
        font: 13px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      .card h3 { margin: 0 0 4px; font-size: 15px; }
      .sub { color: #a9adb5; margin-bottom: 12px; }
      .url {
        font-family: ui-monospace, Menlo, monospace; font-size: 11px; word-break: break-all;
        background: #0e0f11; border: 1px solid #2a2c31; border-radius: 8px;
        padding: 8px; color: #cfd3da; margin-bottom: 12px; max-height: 74px; overflow: auto;
      }
      ul { margin: 0 0 14px; padding-left: 18px; }
      li { margin-bottom: 4px; }
      .row { display: flex; gap: 8px; justify-content: flex-end; }
      button {
        font: inherit; padding: 8px 13px; border-radius: 8px; cursor: pointer;
        border: 1px solid #34373d; background: #22252a; color: #e8eaee;
      }
      button.primary { background: #2e6bd8; border-color: #2e6bd8; color: #fff; font-weight: 600; }
      .banner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
        background: #8c1d1d; color: #fff; padding: 9px 14px; pointer-events: auto;
        font: 13px/1.4 -apple-system, "Segoe UI", Roboto, sans-serif;
        display: flex; gap: 12px; align-items: center; justify-content: center;
      }
      .banner b { font-weight: 700; }
      .banner button { padding: 4px 10px; font-size: 12px; background: rgba(255,255,255,.15); border-color: rgba(255,255,255,.3); color: #fff; }
    </style>
    <div class="pill" id="pill"></div>
  `;
  (document.body || document.documentElement).appendChild(host);
  pill = shadow.getElementById('pill');
  return shadow;
}

function labelFor(band) {
  return band === 'danger' ? 'Berbahaya' : band === 'warn' ? 'Mencurigakan' : 'Tidak ada sinyal bahaya';
}

function showPill(x, y, verdict, host) {
  ensureUI();
  pill.className = 'pill show ' + verdict.band;
  const first = verdict.reasons[0] || 'Tidak ada pola mencurigakan yang dikenal.';
  const more = verdict.reasons.length > 1 ? ' +' + (verdict.reasons.length - 1) + ' lagi' : '';
  pill.innerHTML = '';
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = labelFor(verdict.band);
  const r = document.createElement('span');
  r.className = 'r';
  r.textContent = first + more;
  const h = document.createElement('span');
  h.className = 'host';
  h.textContent = host;
  pill.appendChild(t); pill.appendChild(r); pill.appendChild(document.createElement('br')); pill.appendChild(h);

  const pad = 14;
  const w = pill.offsetWidth || 240;
  const hgt = pill.offsetHeight || 60;
  let left = Math.min(x + pad, window.innerWidth - w - 10);
  let top = y + pad;
  if (top + hgt > window.innerHeight - 10) top = Math.max(10, y - hgt - pad);
  pill.style.left = Math.max(8, left) + 'px';
  pill.style.top = top + 'px';
}

function hidePill() {
  if (pill) pill.className = 'pill';
}

function showBlockCard(url, verdict, onProceed) {
  ensureUI();
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  const reasons = verdict.reasons.slice(0, 4).map((r) => '<li>' + escapeHtml(r) + '</li>').join('');
  wrap.innerHTML = `
    <div class="card" role="dialog" aria-modal="true">
      <h3>Link ini terlihat berbahaya</h3>
      <div class="sub">CekDulu menahan klik ini. Kamu masih bisa lanjut kalau yakin.</div>
      <div class="url">${escapeHtml(url)}</div>
      <ul>${reasons}</ul>
      <div class="row">
        <button class="primary" id="back">Kembali</button>
        <button id="go">Tetap buka</button>
      </div>
    </div>`;
  shadow.appendChild(wrap);
  const close = () => { wrap.remove(); };
  shadow.getElementById('back').addEventListener('click', close);
  shadow.getElementById('back').focus();
  shadow.getElementById('go').addEventListener('click', () => { close(); onProceed(); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

function showBanner(text, actionLabel, onAction) {
  ensureUI();
  const bar = document.createElement('div');
  bar.className = 'banner';
  bar.innerHTML = '<span>' + escapeHtml(text) + '</span>';
  if (actionLabel) {
    const b = document.createElement('button');
    b.textContent = actionLabel;
    b.addEventListener('click', onAction);
    bar.appendChild(b);
  }
  const close = document.createElement('button');
  close.textContent = 'Tutup';
  close.addEventListener('click', () => bar.remove());
  bar.appendChild(close);
  (document.body || document.documentElement).appendChild(bar);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* --------------------------------------------------------------- hover --- */

document.addEventListener('mouseover', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) { hidePill(); return; }
  const href = a.href;
  if (!/^https?:/i.test(href)) { hidePill(); return; }
  if (href === lastHoverUrl) return;
  lastHoverUrl = href;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    const v = CekEngine.check(href);
    const host = CekEngine.hostOf(href);
    showPill(e.clientX, e.clientY, v, host);
    prefetch(href);
  }, HOVER_DEBOUNCE_MS);
}, true);

document.addEventListener('mouseout', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  // moving between child elements inside the same link is not "leaving" it
  if (e.relatedTarget && a.contains(e.relatedTarget)) return;
  clearTimeout(hoverTimer);
  hidePill();
  lastHoverUrl = '';
}, true);

/** Warm the cache while the pointer is still on the link, so the click is instant. */
function prefetch(href) {
  try {
    chrome.runtime.sendMessage({ type: 'verdict:lookup', urls: [href] }, (res) => {
      if (!res || !res.results) return;
      for (const h in res.results) {
        if (res.results[h].threat) remoteVerdicts.set(h, res.results[h].threat);
      }
    });
  } catch (e) { /* extension reloaded */ }
}

/* --------------------------------------------------------------- click --- */

function sameSite(href) {
  try {
    return CekEngine.registrableDomain(CekEngine.hostOf(href)) ===
           CekEngine.registrableDomain(location.hostname);
  } catch (e) { return true; }
}

function go(a, href) {
  if (a.target === '_blank' || a.getAttribute('rel') === 'noopener') {
    window.open(href, '_blank', 'noopener');
  } else {
    location.assign(href);
  }
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  const href = a.href;
  if (!/^https?:/i.test(href)) return;
  if (sameSite(href)) return;          // never slow down in-site navigation

  const v = CekEngine.check(href);
  const host = CekEngine.hostOf(href);

  const cachedThreat = remoteVerdicts.get(host);
  if (cachedThreat) {
    e.preventDefault(); e.stopPropagation();
    showBlockCard(href, { reasons: ['Terdaftar di database ancaman: ' + cachedThreat] }, () => go(a, href));
    return;
  }

  if (v.band === 'danger') {
    e.preventDefault(); e.stopPropagation();
    showBlockCard(href, v, () => go(a, href));
    return;
  }

  // No remote layer configured, nothing to add: get out of the user's way.
  if (!remoteEnabled) return;

  // Unknown risk with a database available: hold the click for at most
  // REMOTE_BUDGET_MS, then let it through no matter what.
  e.preventDefault(); e.stopPropagation();
  let moved = false;
  const proceed = () => { if (moved) return; moved = true; go(a, href); };
  const budget = setTimeout(proceed, REMOTE_BUDGET_MS);

  try {
    chrome.runtime.sendMessage({ type: 'verdict:lookup', urls: [href] }, (res) => {
      clearTimeout(budget);
      if (moved) return;
      const r = res && res.results && res.results[host];
      if (r && r.threat) {
        moved = true;
        remoteVerdicts.set(host, r.threat);
        showBlockCard(href, { reasons: ['Terdaftar di database ancaman: ' + r.threat] }, () => go(a, href));
      } else {
        proceed();
      }
    });
  } catch (err) {
    clearTimeout(budget);
    proceed();
  }
}, true);

/* -------------------------------------------------- on-load page check --- */

function checkLandingPage() {
  const href = location.href;
  if (!/^https?:/i.test(href)) return;
  const v = CekEngine.check(href);
  const host = CekEngine.hostOf(href);

  if (v.band === 'danger') {
    showBanner('Halaman ini punya ciri yang sering dipakai phishing. Jangan isi data apa pun di sini.', 'Tutup tab', () => {
      window.close();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkLandingPage, { once: true });
} else {
  checkLandingPage();
}
