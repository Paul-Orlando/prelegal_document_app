// Input safety, security headers, error handling, deployment checks, and
// making sure no secrets or real contact details are in the repository.
import { Client, startServer } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../server/config.js';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.close());

describe('user input is never treated as markup', () => {
  test('the preview escapes HTML typed into an answer', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    await c.patch(`/api/documents/${doc.id}`, { values: { party1: '<img src=x onerror=alert(1)><script>alert(2)</script>' } });
    const { data } = await c.get(`/api/documents/${doc.id}/preview`);
    assert.doesNotMatch(data.html, /<script|<img/);
    assert.match(data.html, /&lt;script&gt;/);
  });

  test('the preview contains no template HTML', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('cloud-service-agreement');
    const { data } = await c.get(`/api/documents/${doc.id}/preview`);
    assert.doesNotMatch(data.html, /<span|coverpage_link/);
  });

  test('a pipe in an answer cannot break the key terms table', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    await c.patch(`/api/documents/${doc.id}`, { values: { party1: 'A | B | C' } });
    const { data } = await c.get(`/api/documents/${doc.id}/preview`);
    assert.match(data.html, /A \| B \| C/);
  });
});

describe('security headers and caching', () => {
  test('pages and API responses carry the security headers', async () => {
    for (const url of ['/', '/api/catalog', '/api/health']) {
      const res = await fetch(srv.base + url);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff', url);
      assert.equal(res.headers.get('x-frame-options'), 'DENY', url);
      assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', url);
      assert.equal(res.headers.get('x-powered-by'), null, url);
    }
  });

  test('HTML, CSS and JS are revalidated so a deploy shows on refresh', async () => {
    for (const url of ['/', '/styles.css', '/app.js']) {
      const res = await fetch(srv.base + url);
      assert.equal(res.status, 200, url);
      assert.equal(res.headers.get('cache-control'), 'no-cache', url);
    }
  });
});

describe('errors', () => {
  test('health check reports the database is readable', async () => {
    const res = await fetch(`${srv.base}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });

  test('unknown API routes return JSON 404', async () => {
    const res = await fetch(`${srv.base}/api/does-not-exist`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /application\/json/);
  });

  test('malformed JSON is a 400 with a plain message', async () => {
    const c = new Client(srv.base);
    const res = await c.request('POST', '/api/support/chat', '{"messages": [');
    assert.equal(res.status, 400);
    assert.match(res.data.error, /not valid JSON/);
  });

  test('requests over 1 MB are refused', async () => {
    const c = new Client(srv.base);
    const res = await c.post('/api/support/chat', { messages: [{ role: 'user', content: 'x'.repeat(1_100_000) }] });
    assert.equal(res.status, 413);
  });
});

describe('repository hygiene', () => {
  const tracked = () => {
    try {
      return execFileSync('git', ['ls-files'], { cwd: ROOT_DIR, encoding: 'utf8' }).split('\n').filter(Boolean);
    } catch {
      return [];
    }
  };
  const textFiles = () =>
    tracked().filter((f) => /\.(js|mjs|json|md|html|css|txt|yaml|yml|env|example|bat|sh|ps1)$/.test(f) || f === '.env.example');

  test('no API keys are committed', () => {
    for (const f of textFiles()) {
      const text = fs.readFileSync(path.join(ROOT_DIR, f), 'utf8');
      assert.doesNotMatch(text, /sk-or-v1-[a-f0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}/, f);
    }
  });

  test('.env is ignored and never committed', () => {
    assert.ok(!tracked().includes('.env'));
    assert.match(fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8'), /^\.env$/m);
  });

  test('.env.example has no real key', () => {
    const text = fs.readFileSync(path.join(ROOT_DIR, '.env.example'), 'utf8');
    assert.match(text, /^OPENROUTER_API_KEY=\s*$/m);
  });

  test('phone numbers in the app are all fictional 555-01xx numbers', () => {
    for (const f of ['public/index.html', 'public/app.js', 'server/firm.js', 'server/ai/support.js']) {
      const text = fs.readFileSync(path.join(ROOT_DIR, f), 'utf8');
      for (const m of text.matchAll(/\(\d{3}\) \d{3}-\d{4}/g)) assert.match(m[0], /555-01\d\d/, `${f}: ${m[0]}`);
    }
  });
});

describe('demo notice', () => {
  test('the page states it is a demo and not for real legal matters', async () => {
    const html = await (await fetch(`${srv.base}/`)).text();
    assert.match(html, /id="demo-strip"/);
    assert.match(html, /Don't use it for real legal matters/);
    assert.match(html, /Before you start/);
    assert.match(html, /watermarked "SAMPLE"/);
  });

  test('Ask Prelegal says a demo document must not be used', async () => {
    const c = new Client(srv.base);
    const res = await c.post('/api/support/chat', { messages: [{ role: 'user', content: 'Can I use this NDA with my client?' }] });
    assert.match(res.data.text, /^No\./);
    assert.match(res.data.text, /sample/);
    assert.match(res.data.text, /attorney/);
  });
});

describe('unexpected errors', () => {
  test('internal error details are never sent to the browser', async () => {
    const { createApp } = await import('../server/app.js');
    const app = createApp();
    // Call the app's final error handler directly with an unexpected error.
    const handler = app._router.stack.at(-1).handle;
    let sent;
    const res = { status(code) { this.code = code; return this; }, json(body) { sent = body; } };
    const silence = console.error;
    console.error = () => {};
    try {
      handler(new Error('SQLITE_CORRUPT: secret table details'), {}, res, () => {});
    } finally {
      console.error = silence;
    }
    assert.equal(res.code, 500);
    assert.doesNotMatch(sent.error, /SQLITE|secret/);
  });
});
