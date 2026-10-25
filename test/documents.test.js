// Creating, editing and deleting documents, and the per-visitor demo limit.
import { Client, startServer } from './helpers.js';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetRateLimits } from '../server/rateLimit.js';
import { DOCUMENT_SPECS } from '../server/documentSpecs.js';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.close());
beforeEach(() => resetRateLimits());

describe('catalog', () => {
  test('lists all 11 supported agreements', async () => {
    const res = await new Client(srv.base).get('/api/catalog');
    assert.equal(res.status, 200);
    assert.equal(res.data.documentTypes.length, 11);
    for (const t of res.data.documentTypes) {
      assert.ok(t.id && t.name && t.description, t.id);
    }
  });
});

describe('documents', () => {
  test('every agreement type can be started from the menu', async () => {
    const c = new Client(srv.base, { ip: '10.0.0.1' });
    for (const spec of DOCUMENT_SPECS) {
      const doc = await c.newDocument(spec.id);
      assert.equal(doc.specId, spec.id);
      assert.equal(doc.specName, spec.name);
      assert.equal(doc.isComplete, false);
      assert.ok(doc.missingRequired.length > 0);
    }
  });

  test('an unknown agreement type is rejected', async () => {
    const res = await new Client(srv.base).post('/api/documents', { specId: 'employment-contract' });
    assert.equal(res.status, 400);
  });

  test('editing only accepts fields the agreement has', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    const res = await c.patch(`/api/documents/${doc.id}`, {
      values: { party1: 'Duck LLC', notAField: 'x', __proto__: 'y' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.document.values, { party1: 'Duck LLC' });
  });

  test('values are stored as text', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    const res = await c.patch(`/api/documents/${doc.id}`, { values: { party1: 12345 } });
    assert.equal(res.data.document.values.party1, '12345');
  });

  test('titles are capped at 200 characters', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    const res = await c.patch(`/api/documents/${doc.id}`, { title: 'x'.repeat(500) });
    assert.equal(res.data.document.title.length, 200);
  });

  test('switching type clears answers from the old type', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    await c.patch(`/api/documents/${doc.id}`, { values: { party1: 'Duck LLC' } });
    const res = await c.patch(`/api/documents/${doc.id}`, { specId: 'pilot-agreement' });
    assert.equal(res.data.document.specId, 'pilot-agreement');
    assert.deepEqual(res.data.document.values, {});
  });

  test('a document is complete once every required field is filled', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    const spec = DOCUMENT_SPECS.find((s) => s.id === 'mutual-nda');
    const values = Object.fromEntries(spec.fields.filter((f) => f.required).map((f) => [f.key, 'x']));
    const res = await c.patch(`/api/documents/${doc.id}`, { values });
    assert.equal(res.data.document.isComplete, true);
    assert.deepEqual(res.data.document.missingRequired, []);
  });

  test('deleting removes the document and its conversation', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    await c.post(`/api/documents/${doc.id}/messages`, { kickoff: true });
    assert.equal((await c.delete(`/api/documents/${doc.id}`)).status, 200);
    assert.equal((await c.get(`/api/documents/${doc.id}`)).status, 404);
    assert.equal((await c.delete(`/api/documents/${doc.id}`)).status, 404);
  });
});

describe('demo limit: new documents', () => {
  test('30 new documents per hour per visitor address, then a clear message', async () => {
    const c = new Client(srv.base, { ip: '10.0.0.30' });
    for (let i = 0; i < 30; i++) await c.newDocument('mutual-nda');
    const res = await c.post('/api/documents', { specId: 'mutual-nda' });
    assert.equal(res.status, 429);
    assert.match(res.data.error, /30 new documents per hour/);
    assert.match(res.data.error, /minute/);
  });

  test('the limit is per address, so another visitor is unaffected', async () => {
    const a = new Client(srv.base, { ip: '10.0.0.31' });
    for (let i = 0; i < 30; i++) await a.newDocument('mutual-nda');
    const b = new Client(srv.base, { ip: '10.0.0.32' });
    assert.ok(await b.newDocument('mutual-nda'));
  });

  test('clearing cookies does not reset the limit', async () => {
    for (let i = 0; i < 30; i++) await new Client(srv.base, { ip: '10.0.0.33' }).newDocument('mutual-nda');
    const fresh = new Client(srv.base, { ip: '10.0.0.33' });
    assert.equal((await fresh.post('/api/documents', { specId: 'mutual-nda' })).status, 429);
  });

  test('the limit is on unless explicitly switched off', async () => {
    const { limitsEnabled } = await import('../server/rateLimit.js');
    const saved = process.env.PRELEGAL_DEMO_LIMITS;
    try {
      delete process.env.PRELEGAL_DEMO_LIMITS;
      assert.equal(limitsEnabled(), true);
      process.env.PRELEGAL_DEMO_LIMITS = '0';
      assert.equal(limitsEnabled(), true, 'only the word off switches it off');
      process.env.PRELEGAL_DEMO_LIMITS = 'off';
      assert.equal(limitsEnabled(), false);
    } finally {
      process.env.PRELEGAL_DEMO_LIMITS = saved;
    }
  });
});
