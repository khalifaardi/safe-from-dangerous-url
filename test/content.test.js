'use strict';

/**
 * Behaviour tests for CekDulu.
 *
 * These run in jsdom with a stubbed `chrome` API. They assert contracts, not
 * "it rendered": a safe click must not be touched, a known-bad click must be
 * held, and an unknown click must proceed once the time budget expires.
 *
 *   npm test
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = path.join(__dirname, '..', 'src');
const engineSrc = fs.readFileSync(path.join(SRC, 'engine.js'), 'utf8');
const contentSrc = fs.readFileSync(path.join(SRC, 'content.js'), 'utf8');
const engine = require(path.join(SRC, 'engine.js'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeDom({ proxyUrl = '', threat = null } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body>
       <a id="bad" href="https://bca-verifikasi-akun.my.id/klaim"><span id="kid">klaim</span></a>
       <a id="out" href="https://tokopedia.com/p/1">outbound</a>
     </body></html>`,
    { url: 'https://example.com/article', runScripts: 'outside-only', pretendToBeVisual: true }
  );

  const { window } = dom;
  const sent = [];
  window.chrome = {
    storage: {
      local: { get: (k, cb) => cb && cb({ proxyUrl }) },
      session: { get: async () => ({}), set: async () => {}, remove: async () => {} },
    },
    runtime: {
      lastError: undefined,
      sendMessage: (msg, cb) => {
        sent.push(msg);
        if (cb) cb({ ok: true, results: threat ? { 'tokopedia.com': { threat } } : {} });
      },
    },
  };

  window.eval(engineSrc);
  window.eval(contentSrc);
  return { window, doc: window.document, sent };
}

const hostOf = (doc) => doc.querySelector('div[id="__cekdulu_host__"]');

function clickLink(win, doc, id) {
  const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  doc.getElementById(id).dispatchEvent(ev);
  return ev;
}

/* ------------------------------------------------------------------ engine -- */

test('engine: official domains score zero', () => {
  const legit = [
    'https://www.bca.co.id/id/individu',
    'https://klikbca.com/',
    'https://ibanking.bri.co.id/',
    'https://tokopedia.com',
    'https://drive.google.com/file/d/abc',
    'https://bit.ly/3xYz',
  ];
  for (const u of legit) {
    const v = engine.check(u);
    assert.strictEqual(v.band, 'ok', `${u} should be ok, got ${v.band} (${v.score})`);
  }
});

test('engine: impersonation is flagged', () => {
  const bad = [
    'https://bca-login-verifikasi.my.id/',
    'https://dana-poin-100jt.xyz/claim',
    'https://whatsapp.com.free-gift.biz.id/',
    'https://microsoft-support-help.vercel.app/',
  ];
  for (const u of bad) {
    assert.strictEqual(engine.check(u).band, 'danger', `${u} should be danger`);
  }
});

test('engine: typosquat lands in the middle band, not the top one', () => {
  for (const u of ['https://www.shope.co.id/promo', 'https://tokopediia.com']) {
    assert.strictEqual(engine.check(u).band, 'warn', `${u} should be warn`);
  }
});

test('engine: rejects non-web schemes', () => {
  const v = engine.check('not a url at all');
  assert.strictEqual(v.band, 'danger');
});

/* ---------------------------------------------------------------- interface -- */

test('ui is lazy: nothing is injected at idle', () => {
  const { doc } = makeDom();
  assert.strictEqual(hostOf(doc), null);
});

test('hover shows a verdict and never a score', async () => {
  const { window, doc } = makeDom();
  const a = doc.getElementById('bad');
  a.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true, clientX: 40, clientY: 40 }));
  await wait(200);

  const pill = hostOf(doc).shadowRoot.getElementById('pill');
  assert.ok(pill.className.includes('danger'), 'pill should be in the danger style');

  const title = pill.querySelector('.t').textContent;
  assert.strictEqual(title, 'Berbahaya');
  assert.ok(!/\d/.test(title), 'the score must not appear in the verdict line');
});

test('re-hovering the same link still shows the pill', async () => {
  const { window, doc } = makeDom();
  const a = doc.getElementById('bad');
  const over = () => a.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true, clientX: 40, clientY: 40 }));

  over();
  await wait(200);

  a.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true, relatedTarget: doc.body }));
  await wait(40);
  assert.ok(!hostOf(doc).shadowRoot.getElementById('pill').className.includes('show'));

  over();
  await wait(200);
  assert.ok(hostOf(doc).shadowRoot.getElementById('pill').className.includes('show'));
});

test('moving onto a child element does not hide the pill', async () => {
  const { window, doc } = makeDom();
  const a = doc.getElementById('bad');
  const kid = doc.getElementById('kid');

  a.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true, clientX: 40, clientY: 40 }));
  await wait(200);
  a.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true, relatedTarget: kid }));
  await wait(40);

  assert.ok(hostOf(doc).shadowRoot.getElementById('pill').className.includes('show'));
});

/* -------------------------------------------------------------- click path -- */

test('no database configured: a safe click is not touched', async () => {
  const { window, doc, sent } = makeDom({ proxyUrl: '' });
  await wait(20);
  const ev = clickLink(window, doc, 'out');
  assert.strictEqual(ev.defaultPrevented, false);
  assert.strictEqual(sent.length, 0, 'no message should be sent when there is nothing to ask');
});

test('dangerous link: click is prevented and the card explains why', async () => {
  const { window, doc } = makeDom({ proxyUrl: '' });
  await wait(20);
  const ev = clickLink(window, doc, 'bad');
  assert.strictEqual(ev.defaultPrevented, true);

  const card = hostOf(doc).shadowRoot.querySelector('.overlay');
  assert.ok(card, 'block card should be open');
  assert.ok(card.querySelectorAll('li').length >= 1);
  assert.ok(card.querySelector('#go'), 'there must always be a way to proceed');
});

test('database reports a threat: click is prevented', async () => {
  const { window, doc } = makeDom({ proxyUrl: 'https://x.workers.dev', threat: 'SOCIAL_ENGINEERING' });
  await wait(20);
  const ev = clickLink(window, doc, 'out');
  await wait(40);

  const card = hostOf(doc).shadowRoot.querySelector('.overlay');
  assert.strictEqual(ev.defaultPrevented, true);
  assert.ok(card);
  assert.match(card.textContent, /SOCIAL_ENGINEERING/);
});

test('database is silent: the click proceeds after the budget', async () => {
  const { window, doc } = makeDom({ proxyUrl: 'https://x.workers.dev', threat: null });
  await wait(20);
  clickLink(window, doc, 'out');
  await wait(200);

  const host = hostOf(doc);
  assert.ok(!(host && host.shadowRoot.querySelector('.overlay')), 'no card should appear');
});
