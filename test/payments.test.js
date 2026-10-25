// The paywall: off in the demo (downloads always work), and when switched on,
// downloads need a purchased agreement or an active plan.
import { Client, startServer } from './helpers.js';
import { after, afterEach, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { activePlan, canDownload, recordPurchase } from '../server/payments.js';
import { db } from '../server/db.js';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.close());
afterEach(() => {
  delete process.env.PRELEGAL_PAYMENTS;
  delete process.env.PRELEGAL_PAYMENT_PROVIDER;
});

const download = (c, doc) => c.get(`/api/documents/${doc.id}/download?format=pdf`, { raw: true });
const userId = async (c) => (await c.get('/api/session')).data.user.id;

describe('payments off (the demo)', () => {
  test('downloads work without paying', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('cloud-service-agreement');
    assert.equal((await download(c, doc)).status, 200);
  });

  test('checkout is not available', async () => {
    const c = new Client(srv.base);
    const res = await c.post('/api/checkout', { kind: 'plan', planId: 'twelve-month' });
    assert.equal(res.status, 404);
  });

  test('payments are off unless set to exactly "on"', async () => {
    const c = new Client(srv.base);
    for (const value of ['', 'true', '1', 'yes']) {
      process.env.PRELEGAL_PAYMENTS = value;
      assert.equal((await c.get('/api/entitlements')).data.paymentsEnabled, false, value);
    }
  });
});

describe('payments on', () => {
  test('a download needs payment, and the 402 lists the options with prices', async () => {
    process.env.PRELEGAL_PAYMENTS = 'on';
    const c = new Client(srv.base);
    const doc = await c.newDocument('cloud-service-agreement');
    const res = await c.get(`/api/documents/${doc.id}/download?format=pdf`);
    assert.equal(res.status, 402);
    assert.equal(res.data.paymentRequired, true);
    assert.equal(res.data.options.single.price, 99);
    assert.deepEqual(res.data.options.plans.map((p) => p.price), [249, 449]);
  });

  test('without a payment provider, checkout says so clearly', async () => {
    process.env.PRELEGAL_PAYMENTS = 'on';
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    const res = await c.post('/api/checkout', { kind: 'document', documentId: doc.id });
    assert.equal(res.status, 503);
    assert.match(res.data.error, /not connected yet/);
  });

  test('the test provider is refused in production', async () => {
    process.env.PRELEGAL_PAYMENTS = 'on';
    process.env.PRELEGAL_PAYMENT_PROVIDER = 'test';
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const c = new Client(srv.base);
      const res = await c.post('/api/checkout', { kind: 'plan', planId: 'six-month' });
      assert.equal(res.status, 503);
    } finally {
      process.env.NODE_ENV = saved;
    }
  });

  test('buying one agreement unlocks that agreement only, at its price', async () => {
    process.env.PRELEGAL_PAYMENTS = 'on';
    process.env.PRELEGAL_PAYMENT_PROVIDER = 'test';
    const c = new Client(srv.base);
    const bought = await c.newDocument('mutual-nda');
    const other = await c.newDocument('mutual-nda');
    const res = await c.post('/api/checkout', { kind: 'document', documentId: bought.id });
    assert.equal(res.status, 201);
    assert.equal(res.data.purchase.amount, 49);
    assert.deepEqual(res.data.entitlements.documents, [bought.id]);
    assert.equal((await download(c, bought)).status, 200);
    assert.equal((await download(c, other)).status, 402);
  });

  test('a plan unlocks every agreement until it ends', async () => {
    process.env.PRELEGAL_PAYMENTS = 'on';
    process.env.PRELEGAL_PAYMENT_PROVIDER = 'test';
    const c = new Client(srv.base);
    const res = await c.post('/api/checkout', { kind: 'plan', planId: 'twelve-month' });
    assert.equal(res.data.purchase.amount, 449);
    assert.ok(res.data.entitlements.plan);
    for (const spec of ['mutual-nda', 'cloud-service-agreement', 'data-processing-agreement']) {
      assert.equal((await download(c, await c.newDocument(spec))).status, 200, spec);
    }
  });

  test("you can't buy an agreement that isn't yours", async () => {
    process.env.PRELEGAL_PAYMENTS = 'on';
    process.env.PRELEGAL_PAYMENT_PROVIDER = 'test';
    const alice = new Client(srv.base);
    const bob = new Client(srv.base);
    const doc = await alice.newDocument('mutual-nda');
    assert.equal((await bob.post('/api/checkout', { kind: 'document', documentId: doc.id })).status, 404);
  });

  test('unknown plans and purchase types are rejected', async () => {
    process.env.PRELEGAL_PAYMENTS = 'on';
    process.env.PRELEGAL_PAYMENT_PROVIDER = 'test';
    const c = new Client(srv.base);
    assert.equal((await c.post('/api/checkout', { kind: 'plan', planId: 'lifetime' })).status, 400);
    assert.equal((await c.post('/api/checkout', { kind: 'refund' })).status, 400);
  });

  test('prices come from the server, not the request', async () => {
    process.env.PRELEGAL_PAYMENTS = 'on';
    process.env.PRELEGAL_PAYMENT_PROVIDER = 'test';
    const c = new Client(srv.base);
    const res = await c.post('/api/checkout', { kind: 'plan', planId: 'six-month', amount: 1, price: 0 });
    assert.equal(res.data.purchase.amount, 249);
  });
});

describe('plan dates', () => {
  test('a 6-month plan lasts 6 months, and an early renewal adds on instead of overlapping', async () => {
    const c = new Client(srv.base);
    const id = await userId(c);
    const now = new Date('2026-01-15T12:00:00Z');
    const first = recordPurchase(id, { kind: 'plan', planId: 'six-month', provider: 'test', now });
    assert.equal(first.expiresAt, '2026-07-15T12:00:00.000Z');
    const second = recordPurchase(id, { kind: 'plan', planId: 'twelve-month', provider: 'test', now: new Date('2026-03-01T00:00:00Z') });
    assert.equal(second.expiresAt, '2027-07-15T12:00:00.000Z');
  });

  test('an expired plan no longer unlocks downloads', async () => {
    process.env.PRELEGAL_PAYMENTS = 'on';
    const c = new Client(srv.base);
    const id = await userId(c);
    const doc = await c.newDocument('mutual-nda');
    recordPurchase(id, { kind: 'plan', planId: 'six-month', provider: 'test', now: new Date('2020-01-01T00:00:00Z') });
    assert.equal(activePlan(id), null);
    assert.equal(canDownload(id, doc.id).allowed, false);
    assert.equal(canDownload(id, doc.id, new Date('2020-03-01T00:00:00Z')).reason, 'plan');
  });

  test('deleting a visitor removes their purchases', async () => {
    const c = new Client(srv.base);
    const id = await userId(c);
    recordPurchase(id, { kind: 'plan', planId: 'six-month', provider: 'test' });
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM purchases WHERE user_id = ?').get(id).n, 0);
  });
});
