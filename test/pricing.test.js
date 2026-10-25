// Pricing and plans: one price per agreement, plan arithmetic, the pricing
// endpoint, and the assistant's pricing answers (scripted mode).
import { Client, startServer } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PRICING, breakEven, perMonth, priceFor, pricingSummary } from '../server/pricing.js';
import { DOCUMENT_SPECS } from '../server/documentSpecs.js';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.close());

describe('prices', () => {
  test('every agreement has exactly one single-document price', () => {
    for (const spec of DOCUMENT_SPECS) {
      const p = priceFor(spec.id);
      assert.ok(p, spec.id);
      assert.ok([49, 99].includes(p.price), `${spec.id}: ${p.price}`);
    }
    assert.equal(priceFor('employment-contract'), null);
  });

  test('NDAs are Essential and SaaS contracts are Commercial', () => {
    assert.equal(priceFor('mutual-nda').tier, 'essential');
    assert.equal(priceFor('cloud-service-agreement').tier, 'commercial');
  });

  test('plans: 6 months for $249 and 12 months for $449', () => {
    const [six, twelve] = PRICING.plans;
    assert.deepEqual([six.months, six.price, twelve.months, twelve.price], [6, 249, 12, 449]);
    assert.equal(twelve.badge, 'Best value');
  });

  test('monthly equivalents and break-even counts are computed, not hand-typed', () => {
    const [six, twelve] = PRICING.plans;
    assert.equal(perMonth(six), 41.5);
    assert.equal(perMonth(twelve), 37.42);
    assert.ok(perMonth(twelve) < perMonth(six), 'the longer plan is cheaper per month');
    assert.equal(breakEven(six, 'commercial'), 3); // 249 / 99 = 2.5 → 3
    assert.equal(breakEven(twelve, 'commercial'), 5); // 449 / 99 = 4.5 → 5
    assert.equal(breakEven(six, 'essential'), 6); // 249 / 49 = 5.1 → 6
  });

  test('attorney review costs less for plan members', () => {
    assert.ok(PRICING.attorneyReview.memberPrice < PRICING.attorneyReview.price);
  });

  test('the assistant summary states every price', () => {
    const text = pricingSummary();
    for (const n of ['$49', '$99', '$249', '$449', '$195', '$150', '$41.50', '$37.42']) assert.ok(text.includes(n), n);
    assert.match(text, /No payment is taken/);
  });
});

describe('pricing endpoint', () => {
  test('returns tiers with agreement names and plans with derived numbers', async () => {
    const { status, data } = await new Client(srv.base).get('/api/pricing');
    assert.equal(status, 200);
    const names = data.pricing.tiers.flatMap((t) => t.agreements.map((a) => a.name));
    assert.equal(names.length, 11);
    assert.ok(names.includes('Mutual Non-Disclosure Agreement'));
    assert.equal(data.pricing.plans[1].perMonth, 37.42);
    assert.deepEqual(data.pricing.plans[0].breakEven, { essential: 6, commercial: 3 });
  });

  test("a document carries its own price", async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('cloud-service-agreement');
    assert.deepEqual(doc.price, { tier: 'commercial', tierName: 'Commercial', price: 99 });
  });

  test('the page has a Pricing button in the top bar and a pricing section', async () => {
    const html = await (await fetch(`${srv.base}/`)).text();
    assert.match(html, /id="pricing-btn"/);
    assert.match(html, /<section id="pricing"/);
    const bar = html.slice(html.indexOf('<nav class="topbar-actions"'), html.indexOf('</nav>'));
    assert.ok(bar.indexOf('pricing-btn') < bar.indexOf('help-btn'), 'Pricing sits beside Help & support');
  });
});

describe('Ask Prelegal and pricing (scripted mode)', () => {
  const ask = (content) => new Client(srv.base).post('/api/support/chat', { messages: [{ role: 'user', content }] });

  test('a pricing question gets the prices and a View plans button', async () => {
    const { data } = await ask('How much does it cost?');
    assert.match(data.text, /\$49/);
    assert.match(data.text, /\$449/);
    assert.equal(data.showPricing, true);
    assert.equal(data.escalate, false);
  });

  test('attorney review pricing', async () => {
    const { data } = await ask('How much is an attorney review?');
    assert.match(data.text, /\$195/);
    assert.match(data.text, /\$150/);
    assert.equal(data.showPricing, true);
  });

  test('non-pricing answers do not show the button', async () => {
    const { data } = await ask('How do I download my document?');
    assert.equal(data.showPricing, false);
  });
});

describe('pricing estimator', () => {
  // Found in the user test: the Pricing page didn't show the comparison people needed.
  test('10 Commercial agreements over a year: the 12-month plan, saving $541', async () => {
    const { cheapestOption } = await import('../server/pricing.js');
    const r = cheapestOption({ commercial: 10, months: 12 });
    assert.equal(r.best, 'twelve-month');
    assert.equal(r.saving, 541);
    assert.deepEqual(r.options.map((o) => o.cost), [990, 498, 449]);
  });

  test('a single NDA: buying it on its own is cheapest', async () => {
    const { cheapestOption } = await import('../server/pricing.js');
    const r = cheapestOption({ essential: 1, months: 12 });
    assert.equal(r.best, 'single');
    assert.equal(r.saving, 0);
  });

  test('over 6 months, one 6-month plan covers the period', async () => {
    const { cheapestOption } = await import('../server/pricing.js');
    const r = cheapestOption({ commercial: 3, months: 6 });
    assert.equal(r.best, 'six-month');
    assert.equal(r.options.find((o) => o.id === 'six-month').cost, 249);
  });

  test('bad input is clamped, not trusted', async () => {
    const { cheapestOption } = await import('../server/pricing.js');
    const r = cheapestOption({ essential: -5, commercial: 'lots', months: 99 });
    assert.equal(r.essential, 0);
    assert.equal(r.commercial, 0);
    assert.equal(r.months, 12);
    assert.equal(cheapestOption({ commercial: 1e9 }).commercial, 500);
  });

  test('the endpoint returns the same result', async () => {
    const { data } = await new Client(srv.base).get('/api/pricing/estimate?commercial=10&months=12');
    assert.equal(data.best, 'twelve-month');
    assert.equal(data.saving, 541);
  });

  test('the Pricing page has the estimator', async () => {
    const html = await (await fetch(`${srv.base}/`)).text();
    assert.match(html, /Work out the cheapest option/);
  });
});
