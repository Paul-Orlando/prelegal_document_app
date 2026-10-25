// Demo limits: 2 new documents per visitor per hour (with a per-address
// backstop), 40 answers per document, and Ask Prelegal questions per hour.
import { Client, startServer } from './helpers.js';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, limitsEnabled, resetRateLimits } from '../server/rateLimit.js';
import { addMessage } from '../server/db.js';

let srv;
before(async () => {
  process.env.PRELEGAL_DEMO_LIMITS = 'on';
  srv = await startServer();
});
after(() => srv.close());
beforeEach(() => {
  process.env.PRELEGAL_DEMO_LIMITS = 'on';
  resetRateLimits();
});

const start = (c, specId = 'mutual-nda') => c.post('/api/documents', { specId });

describe('the limits', () => {
  test('are the agreed numbers', () => {
    assert.equal(LIMITS.documentsPerVisitor.max, 2);
    assert.equal(LIMITS.documentsPerVisitor.windowMs, 60 * 60 * 1000);
    assert.ok(LIMITS.documentsPerAddress.max > LIMITS.documentsPerVisitor.max, 'shared addresses get more room');
    assert.equal(LIMITS.answersPerDocument, 40);
  });

  test('are on unless explicitly switched off', () => {
    const saved = process.env.PRELEGAL_DEMO_LIMITS;
    try {
      for (const v of [undefined, '', 'on', '0', 'false', 'no']) {
        if (v === undefined) delete process.env.PRELEGAL_DEMO_LIMITS;
        else process.env.PRELEGAL_DEMO_LIMITS = v;
        assert.equal(limitsEnabled(), true, String(v));
      }
      process.env.PRELEGAL_DEMO_LIMITS = 'off';
      assert.equal(limitsEnabled(), false);
    } finally {
      process.env.PRELEGAL_DEMO_LIMITS = saved;
    }
  });
});

describe('new documents: 2 per visitor per hour', () => {
  test('the third document in an hour is refused with a clear message', async () => {
    const c = new Client(srv.base, { ip: '10.9.0.1' });
    assert.equal((await start(c)).status, 201);
    assert.equal((await start(c, 'cloud-service-agreement')).status, 201);
    const res = await start(c, 'pilot-agreement');
    assert.equal(res.status, 429);
    assert.equal(res.data.limit, 'documents');
    assert.match(res.data.error, /2 new documents per hour/);
    assert.match(res.data.error, /about \d+ minutes?/);
    assert.ok(res.data.retryAfterMinutes >= 59);
  });

  test('two of the same type count the same as two different types', async () => {
    const c = new Client(srv.base, { ip: '10.9.0.2' });
    await start(c);
    await start(c);
    assert.equal((await start(c, 'cloud-service-agreement')).status, 429);
  });

  test('a refused or invalid request does not use up the allowance', async () => {
    const c = new Client(srv.base, { ip: '10.9.0.3' });
    assert.equal((await start(c, 'employment-contract')).status, 400);
    assert.equal((await start(c)).status, 201);
    assert.equal((await start(c)).status, 201);
  });

  test('existing drafts keep working after the limit is reached', async () => {
    const c = new Client(srv.base, { ip: '10.9.0.4' });
    const doc = (await start(c)).data.document;
    await start(c);
    assert.equal((await start(c)).status, 429);
    assert.equal((await c.post(`/api/documents/${doc.id}/messages`, { kickoff: true })).status, 200);
    assert.equal((await c.post(`/api/documents/${doc.id}/messages`, { content: 'Duck LLC' })).status, 200);
    assert.equal((await c.get(`/api/documents/${doc.id}/download?format=pdf`, { raw: true })).status, 200);
  });

  test('another visitor is not affected', async () => {
    const a = new Client(srv.base, { ip: '10.9.0.5' });
    await start(a);
    await start(a);
    const b = new Client(srv.base, { ip: '10.9.0.6' });
    assert.equal((await start(b)).status, 201);
  });

  test('clearing cookies gets a few more tries, but the address backstop stops it at 6', async () => {
    const ip = '10.9.0.7';
    for (let i = 0; i < LIMITS.documentsPerAddress.max; i++) {
      assert.equal((await start(new Client(srv.base, { ip }))).status, 201, `fresh visitor ${i + 1}`);
    }
    const res = await start(new Client(srv.base, { ip }));
    assert.equal(res.status, 429);
  });

  test('people sharing an office address each get their own 2', async () => {
    const ip = '10.9.0.8';
    for (const person of [1, 2, 3]) {
      const c = new Client(srv.base, { ip });
      assert.equal((await start(c)).status, 201, `person ${person}, first`);
      assert.equal((await start(c)).status, 201, `person ${person}, second`);
    }
  });

  test('the limit lifts after an hour', async (t) => {
    const c = new Client(srv.base, { ip: '10.9.0.9' });
    await start(c);
    await start(c);
    assert.equal((await start(c)).status, 429);
    const realNow = Date.now;
    t.after(() => { Date.now = realNow; });
    Date.now = () => realNow() + 60 * 60 * 1000 + 1000;
    assert.equal((await start(c)).status, 201);
  });
});

describe('answers per document', () => {
  test('a draft stops answering after 40 answers, but can still be downloaded', async () => {
    const c = new Client(srv.base, { ip: '10.9.1.1' });
    const doc = (await start(c)).data.document;
    for (let i = 0; i < LIMITS.answersPerDocument; i++) addMessage(doc.id, 'assistant', `Question ${i + 1}?`);
    const res = await c.post(`/api/documents/${doc.id}/messages`, { content: 'Duck LLC' });
    assert.equal(res.status, 429);
    assert.equal(res.data.limit, 'answers');
    assert.match(res.data.error, /40 answers/);
    assert.equal((await c.get(`/api/documents/${doc.id}/download?format=md`, { raw: true })).status, 200);
  });
});

describe('Ask Prelegal questions', () => {
  const ask = (c) => c.post('/api/support/chat', { messages: [{ role: 'user', content: 'How do I download?' }] });

  test('20 per visitor per hour, then the help desk number', async () => {
    const c = new Client(srv.base, { ip: '10.9.2.1' });
    await c.get('/api/session');
    for (let i = 0; i < LIMITS.supportPerVisitor.max; i++) assert.equal((await ask(c)).status, 200);
    const res = await ask(c);
    assert.equal(res.status, 429);
    assert.match(res.data.error, /\(404\) 555-0199/);
  });

  test('a second visitor at the same address still gets answers', async () => {
    const ip = '10.9.2.2';
    const a = new Client(srv.base, { ip });
    await a.get('/api/session');
    for (let i = 0; i < LIMITS.supportPerVisitor.max; i++) await ask(a);
    const b = new Client(srv.base, { ip });
    await b.get('/api/session');
    assert.equal((await ask(b)).status, 200);
  });
});

describe('switched off for evaluation runs', () => {
  test('PRELEGAL_DEMO_LIMITS=off allows unlimited documents', async () => {
    process.env.PRELEGAL_DEMO_LIMITS = 'off';
    const c = new Client(srv.base, { ip: '10.9.3.1' });
    for (let i = 0; i < 5; i++) assert.equal((await start(c)).status, 201);
  });
});

describe('changing your mind about the agreement type', () => {
  // Found in the user test: picking the wrong agreement and switching used up
  // one of the visitor's 2 documents.
  test('discarding a draft with no answers gives the visitor that document back', async () => {
    const c = new Client(srv.base, { ip: '10.9.4.1' });
    const first = (await start(c)).data.document;
    const del = await c.delete(`/api/documents/${first.id}`);
    assert.equal(del.data.refunded, true);
    assert.equal((await start(c, 'cloud-service-agreement')).status, 201);
    assert.equal((await start(c, 'pilot-agreement')).status, 201);
    assert.equal((await start(c)).status, 429);
  });

  test('a draft with answers in it still counts after being deleted', async () => {
    const c = new Client(srv.base, { ip: '10.9.4.2' });
    const doc = (await start(c)).data.document;
    await c.patch(`/api/documents/${doc.id}`, { values: { party1: 'Duck LLC' } });
    assert.equal((await c.delete(`/api/documents/${doc.id}`)).data.refunded, false);
    await start(c);
    assert.equal((await start(c)).status, 429);
  });

  test('refunds never lift the per-address backstop', async () => {
    const ip = '10.9.4.3';
    const c = new Client(srv.base, { ip });
    for (let i = 0; i < LIMITS.documentsPerAddress.max; i++) {
      const doc = (await start(c)).data.document;
      assert.ok(doc, `document ${i + 1}`);
      await c.delete(`/api/documents/${doc.id}`);
    }
    assert.equal((await start(c)).status, 429);
  });
});
