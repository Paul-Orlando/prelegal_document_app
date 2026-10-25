// Guest sessions and isolation: the demo has no sign-in, so each browser gets
// its own private workspace. One visitor must never reach another's documents.
import { Client, startServer } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.close());

describe('guest sessions', () => {
  test('first visit creates a guest session with a secure cookie', async () => {
    const res = await fetch(`${srv.base}/api/session`);
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie');
    assert.match(cookie, /^prelegal_session=[a-f0-9]{64};/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    const body = await res.json();
    assert.equal(body.user.displayName, 'Guest');
    assert.ok(['mock', 'openrouter'].includes(body.aiMode));
  });

  test('the same browser keeps the same guest', async () => {
    const c = new Client(srv.base);
    const first = await c.get('/api/session');
    const second = await c.get('/api/session');
    assert.equal(first.data.user.id, second.data.user.id);
    assert.equal(second.headers.get('set-cookie'), null, 'no new cookie once signed in');
  });

  test('a forged or expired cookie just gets a fresh guest', async () => {
    const res = await fetch(`${srv.base}/api/session`, { headers: { cookie: 'prelegal_session=not-a-real-token' } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie'), /prelegal_session=/);
  });

  test('the old sign-in routes are gone', async () => {
    const c = new Client(srv.base);
    for (const path of ['/api/auth/login', '/api/auth/register', '/api/auth/logout']) {
      const res = await c.post(path, { email: 'a@b.c', password: 'password123' });
      assert.equal(res.status, 404, path);
    }
  });

  test('the page has no sign-in form', async () => {
    const html = await (await fetch(`${srv.base}/`)).text();
    assert.doesNotMatch(html, /type="password"/);
    assert.doesNotMatch(html, /auth-screen|Sign in/);
  });
});

describe('isolation between visitors', () => {
  test("one visitor can't see, change, export or delete another's document", async () => {
    const alice = new Client(srv.base);
    const bob = new Client(srv.base);
    const doc = await alice.newDocument('mutual-nda');
    await alice.patch(`/api/documents/${doc.id}`, { values: { party1: 'Alice Secret Co.' } });

    const list = await bob.get('/api/documents');
    assert.equal(list.status, 200);
    assert.ok(!list.data.documents.some((d) => d.id === doc.id), 'not in the other list');

    const attempts = [
      bob.get(`/api/documents/${doc.id}`),
      bob.patch(`/api/documents/${doc.id}`, { values: { party1: 'Hijacked' } }),
      bob.post(`/api/documents/${doc.id}/messages`, { content: 'hello' }),
      bob.get(`/api/documents/${doc.id}/preview`),
      bob.get(`/api/documents/${doc.id}/download?format=pdf`),
      bob.delete(`/api/documents/${doc.id}`),
    ];
    for (const res of await Promise.all(attempts)) assert.equal(res.status, 404);

    const mine = await alice.get(`/api/documents/${doc.id}`);
    assert.equal(mine.data.document.values.party1, 'Alice Secret Co.', 'unchanged');
  });

  test('a made-up document id is a 404, not an error', async () => {
    const c = new Client(srv.base);
    const res = await c.get('/api/documents/00000000-0000-0000-0000-000000000000');
    assert.equal(res.status, 404);
  });
});
