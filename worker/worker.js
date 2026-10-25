/**
 * CekDulu proxy — Cloudflare Worker.
 *
 * Purpose: keep the Google Safe Browsing API key off the client. An extension
 * bundle is public; a key inside it gets scraped and abused within days.
 *
 * Deploy:
 *   1. Enable "Safe Browsing API" in Google Cloud Console, create an API key.
 *   2. wrangler secret put SB_KEY
 *   3. wrangler deploy
 *   4. Paste the workers.dev URL into CekDulu → Pengaturan.
 *
 * NOTE — Safe Browsing is free for NON-COMMERCIAL use only. This product is
 * free, so that is compliant. If it ever earns money, move to Web Risk.
 * NOTE — v4 is supported until 2027-03-31. After that, port `lookup()` to the
 * v5 `urls.search` endpoint.
 *
 * Treat the worker URL as a password: anyone who has it can spend your quota.
 * Turn on Cloudflare's rate limiting rule, or gate it behind a header secret.
 */

const SB_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

function clean(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch (e) {
    return null;
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }

    const urls = Array.isArray(body.urls) ? body.urls.map(clean).filter(Boolean).slice(0, 100) : [];
    if (!urls.length) return json({ threats: [] });

    const payload = {
      client: { clientId: 'cekdulu', clientVersion: '0.1.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: urls.map((u) => ({ url: u })),
      },
    };

    const upstream = await fetch(SB_ENDPOINT + '?key=' + encodeURIComponent(env.SB_KEY), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      return json({ threats: [], error: 'upstream ' + upstream.status }, 200);
    }

    const data = await upstream.json();
    const threats = (data.matches || []).map((m) => ({
      url: (m.threat && m.threat.url) || '',
      type: m.threatType || 'UNKNOWN',
    }));

    return new Response(JSON.stringify({ threats }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=600',
        ...CORS,
      },
    });
  },
};
