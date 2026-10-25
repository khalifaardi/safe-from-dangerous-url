/* CekDulu — local verdict engine.
 * Runs entirely on-device. No network calls in this file, ever.
 * Loaded as a plain script (content script + popup + options).
 */
(function () {
  'use strict';

  // Brand -> official registrable domains. Public information only.
  const BRANDS = [
    ['dana', ['dana.id']],
    ['ovo', ['ovo.id']],
    ['gopay', ['gojek.com']],
    ['shopeepay', ['shopee.co.id']],
    ['linkaja', ['linkaja.id']],
    ['bca', ['bca.co.id', 'klikbca.com']],
    ['mandiri', ['bankmandiri.co.id']],
    ['bri', ['bri.co.id', 'ibanking.bri.co.id']],
    ['bni', ['bni.co.id']],
    ['bsi', ['bankbsi.co.id']],
    ['cimb', ['cimbniaga.co.id']],
    ['permata', ['permata.co.id']],
    ['btpn', ['btpn.com']],
    ['jago', ['jago.com']],
    ['seabank', ['seabank.co.id']],
    ['kredivo', ['kredivo.com']],
    ['akulaku', ['akulaku.com']],
    ['shopee', ['shopee.co.id']],
    ['tokopedia', ['tokopedia.com']],
    ['lazada', ['lazada.co.id']],
    ['bukalapak', ['bukalapak.com']],
    ['blibli', ['blibli.com']],
    ['tiktok', ['tiktok.com']],
    ['whatsapp', ['whatsapp.com']],
    ['telegram', ['telegram.org']],
    ['instagram', ['instagram.com']],
    ['facebook', ['facebook.com']],
    ['google', ['google.com']],
    ['microsoft', ['microsoft.com']],
    ['apple', ['apple.com']],
    ['netflix', ['netflix.com']],
    ['canva', ['canva.com']],
    ['jne', ['jne.co.id']],
    ['jnt', ['jtexpress.id']],
    ['sicepat', ['sicepat.com']],
    ['anteraja', ['anteraja.id']],
    ['pos', ['posindonesia.co.id']],
    ['traveloka', ['traveloka.com']],
    ['tiket', ['tiket.com']],
    ['grab', ['grab.com']],
    ['gojek', ['gojek.com']],
    ['pln', ['pln.co.id']],
    ['bpjs', ['bpjs-kesehatan.go.id']],
    ['pajak', ['pajak.go.id']],
    ['dukcapil', ['dukcapil.kemendagri.go.id']],
    ['imigrasi', ['imigrasi.go.id']],
    ['mobilelegends', ['mobilelegends.com']],
    ['steam', ['steampowered.com', 'steamcommunity.com']],
  ];

  const FREE_HOST_SUFFIX = [
    '.my.id', '.biz.id', '.web.id', '.s.id', '.blogspot.com', '.weebly.com',
    '.wixsite.com', '.vercel.app', '.netlify.app', '.pages.dev', '.000webhostapp.com',
    '.glitch.me', '.replit.app', '.web.app', '.firebaseapp.com', '.godaddysites.com',
    '.wordpress.com', '.github.io', '.ngrok.io', '.trycloudflare.com',
  ];

  const RISKY_TLD = [
    'xyz', 'top', 'icu', 'click', 'zip', 'mov', 'rest', 'buzz', 'cam', 'surf',
    'quest', 'monster', 'cfd', 'sbs', 'lol', 'bond', 'autos', 'beauty', 'makeup',
    'skin', 'hair', 'mom', 'boats', 'homes', 'casa',
  ];

  const SHORTENERS = [
    'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
    'rebrand.ly', 'cutt.ly', 'shorturl.at', 's.id', 'linktr.ee', 't.ly', 'bit.do',
  ];

  const MULTI_PART_SLD = [
    'co.id', 'my.id', 'biz.id', 'web.id', 'or.id', 'ac.id', 'go.id', 'sch.id',
    'net.id', 'desa.id', 'co.uk', 'com.au', 'co.jp', 'com.sg', 'com.my',
  ];

  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase().replace(/\.$/, ''); }
    catch (e) { return ''; }
  }

  /** Approximate eTLD+1. Good enough for ID domains, which is the point. */
  function registrableDomain(host) {
    if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const last2 = parts.slice(-2).join('.');
    if (MULTI_PART_SLD.indexOf(last2) !== -1) return parts.slice(-3).join('.');
    return last2;
  }

  function label(host) {
    const reg = registrableDomain(host);
    return reg.split('.')[0];
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return m || n;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      const t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  function isIpLiteral(host) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.indexOf('[') === 0;
  }

  function looksRandom(s) {
    if (s.length < 12) return false;
    const digits = (s.match(/\d/g) || []).length;
    const vowels = (s.match(/[aeiou]/g) || []).length;
    if (digits / s.length > 0.4) return true;
    return vowels / s.length < 0.18;
  }

  /**
   * Local verdict. Never touches the network and never loads the URL.
   * @returns {{score:number, band:'ok'|'warn'|'danger', reasons:string[], brand:string|null}}
   */
  function check(url) {
    const reasons = [];
    let score = 0;
    let brandHit = null;

    let u;
    try { u = new URL(url); } catch (e) {
      return { score: 60, band: 'danger', reasons: ['URL tidak valid'], brand: null };
    }

    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { score: 60, band: 'danger', reasons: ['Bukan link web biasa (' + u.protocol + ')'], brand: null };
    }

    const host = hostOf(url);
    const reg = registrableDomain(host);
    const lbl = label(host);

    // --- host structure -------------------------------------------------
    if (isIpLiteral(host)) { score += 35; reasons.push('Alamat IP langsung, bukan nama domain'); }

    if (host.indexOf('xn--') !== -1) {
      score += 30;
      reasons.push('Domain pakai karakter non-Latin (punycode) — sering dipakai menyamar');
    }

    const dots = host.split('.').length - 1;
    if (dots >= 4) { score += 12; reasons.push('Subdomain bertingkat tidak wajar'); }

    if (looksRandom(lbl)) { score += 15; reasons.push('Nama domain terlihat acak'); }

    if (u.port && u.port !== '80' && u.port !== '443') {
      score += 10; reasons.push('Pakai port tidak standar (' + u.port + ')');
    }

    if (u.username || u.password) {
      score += 35; reasons.push('Ada "user@" di dalam link — trik menyembunyikan alamat asli');
    }

    // --- brand impersonation -------------------------------------------
    const restOfHost = host.replace(reg, '').replace(/\.$/, '');
    const hostWithoutDots = host.replace(/[^a-z0-9]/g, '');

    for (let i = 0; i < BRANDS.length; i++) {
      const name = BRANDS[i][0];
      const official = BRANDS[i][1];

      if (official.indexOf(reg) !== -1) continue; // this IS the brand

      // brand word appears in the hostname but domain is not theirs
      const inHost = hostWithoutDots.indexOf(name) !== -1 && name.length >= 3;
      // or brand appears in the path/query (phishing pages love /dana/login)
      const path = (u.pathname + u.search).toLowerCase();
      const inPath = path.indexOf(name) !== -1 && name.length >= 4;

      if (inHost) {
        score += 40;
        brandHit = brandHit || name;
        reasons.push('Menyebut "' + name + '" tapi domainnya bukan ' + official[0]);
        break;
      }
      if (inPath && reg.split('.').slice(-1)[0] !== 'id') {
        score += 10;
        brandHit = brandHit || name;
        reasons.push('Halaman menyebut "' + name + '" di alamat, bukan di domain');
        break;
      }

      // typosquat: only for names long enough for edit distance to mean something
      if (name.length >= 6 && Math.abs(lbl.length - name.length) <= 2) {
        const d = levenshtein(lbl, name);
        if (d > 0 && d <= 2) {
          score += 30;
          brandHit = brandHit || name;
          reasons.push('Mirip "' + name + '" tapi beda ' + d + ' huruf (typosquatting)');
          break;
        }
      }
    }

    // --- TLD and hosting ------------------------------------------------
    const tld = reg.split('.').slice(-1)[0];
    if (RISKY_TLD.indexOf(tld) !== -1) {
      score += 10;
      reasons.push('TLD .' + tld + ' sering dipakai kampanye phishing');
    }

    for (let i = 0; i < FREE_HOST_SUFFIX.length; i++) {
      if (host.endsWith(FREE_HOST_SUFFIX[i])) {
        score += brandHit ? 18 : 8;
        reasons.push('Hosting gratis (' + FREE_HOST_SUFFIX[i] + ') — mudah dibuat dan ditinggalkan');
        break;
      }
    }

    // --- URL shape -------------------------------------------------------
    if (url.length > 160) { score += 6; reasons.push('URL sangat panjang'); }
    if (/%[0-9a-f]{2}%[0-9a-f]{2}/i.test(url)) { score += 10; reasons.push('Karakter di-encode berlapis'); }
    if (/\.(apk|exe|msi|scr|bat|jar)(\?|$)/i.test(u.pathname)) {
      score += 45; reasons.push('Link menuju file yang bisa dijalankan (' + u.pathname.split('.').pop() + ')');
    }

    // shorteners are not malicious, just opaque
    let shortener = false;
    for (let i = 0; i < SHORTENERS.length; i++) {
      if (host === SHORTENERS[i] || host.endsWith('.' + SHORTENERS[i])) { shortener = true; break; }
    }
    if (shortener) reasons.push('Link diperpendek — tujuan asli baru terlihat setelah diklik');

    // several independent red flags together are worse than the sum of their parts
    if (reasons.length >= 3) { score += 8; reasons.push('Beberapa sinyal mencurigakan muncul bersamaan'); }

    score = Math.max(0, Math.min(100, score));
    const band = score >= 50 ? 'danger' : score >= 20 ? 'warn' : 'ok';

    return { score: score, band: band, reasons: reasons, brand: brandHit, shortener: shortener };
  }

  const api = { check: check, hostOf: hostOf, registrableDomain: registrableDomain, BRANDS: BRANDS };
  if (typeof globalThis !== 'undefined') globalThis.CekEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
