/* CekDulu — background service worker.
 * Two jobs: (1) cache reputation verdicts per host, (2) optional remote lookup
 * through a proxy URL the user configures. If no proxy is configured, nothing
 * ever leaves the device.
 */
'use strict';

const CACHE_KEY = 'verdict_cache_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h
const CACHE_MAX = 5000;

async function getCache() {
  const obj = await chrome.storage.local.get(CACHE_KEY);
  return obj[CACHE_KEY] || {};
}

async function putCache(map) {
  const keys = Object.keys(map);
  if (keys.length > CACHE_MAX) {
    keys.sort((a, b) => (map[a].ts || 0) - (map[b].ts || 0));
    for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete map[k];
  }
  await chrome.storage.local.set({ [CACHE_KEY]: map });
}

async function getProxyUrl() {
  const o = await chrome.storage.local.get('proxyUrl');
  return (o.proxyUrl || '').trim();
}

function hostOf(u) {
  try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; }
}

/** Ask the user's own proxy (Cloudflare Worker) about a batch of URLs. */
async function remoteCheck(urls) {
  const proxy = await getProxyUrl();
  if (!proxy) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 900);
  try {
    const res = await fetch(proxy, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ urls: urls }),
      signal: ctrl.signal,
      credentials: 'omit',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'verdict:lookup') {
    (async () => {
      const urls = (msg.urls || []).filter(Boolean).slice(0, 100);
      if (!urls.length) return sendResponse({ ok: true, results: {} });

      const cache = await getCache();
      const now = Date.now();
      const results = {};
      const missing = [];

      for (const url of urls) {
        const h = hostOf(url);
        const hit = cache[h];
        if (hit && now - hit.ts < CACHE_TTL) {
          results[h] = { threat: hit.threat, cached: true };
        } else {
          missing.push(url);
        }
      }

      if (missing.length) {
        const data = await remoteCheck(missing);
        if (data && Array.isArray(data.threats)) {
          const threatened = {};
          for (const t of data.threats) {
            const h = hostOf(t.url);
            threatened[h] = t.type || 'UNKNOWN';
          }
          for (const url of missing) {
            const h = hostOf(url);
            const threat = threatened[h] || null;
            results[h] = { threat: threat, cached: false };
            cache[h] = { threat: threat, ts: now };
          }
          await putCache(cache);
        }
      }

      sendResponse({ ok: true, results: results, remote: (await getProxyUrl()) !== '' });
    })();
    return true; // async
  }

  if (msg.type === 'verdict:pending') {
    // remember a post-navigation warning so the destination page can banner it
    (async () => {
      if (!msg.host) return sendResponse({ ok: false });
      await chrome.storage.session.set({ ['warn:' + msg.host]: { at: Date.now(), score: msg.score, reasons: msg.reasons } });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'verdict:consume') {
    (async () => {
      const key = 'warn:' + msg.host;
      const o = await chrome.storage.session.get(key);
      if (o[key]) {
        await chrome.storage.session.remove(key);
        if (Date.now() - o[key].at < 20000) return sendResponse({ ok: true, warn: o[key] });
      }
      sendResponse({ ok: true, warn: null });
    })();
    return true;
  }
});
