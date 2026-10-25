import crypto from 'node:crypto';
import { db } from './db.js';
import { getSpec } from './documentSpecs.js';
import { PRICING, priceFor } from './pricing.js';

/**
 * The paywall: built and tested, switched off in the demo.
 *
 *   PRELEGAL_PAYMENTS=on             downloads need a purchased agreement or an active plan
 *   PRELEGAL_PAYMENT_PROVIDER=test   simulated checkout that succeeds immediately
 *                                    (local testing only; refused when NODE_ENV=production)
 *
 * Going live means adding a real provider (for example Stripe Checkout) in
 * startCheckout() and a webhook that calls recordPurchase() once payment
 * succeeds. Nothing else changes: the download check already reads purchases.
 */

db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('document', 'plan')),
    document_id TEXT,
    plan_id     TEXT,
    amount      INTEGER NOT NULL,
    currency    TEXT NOT NULL,
    provider    TEXT NOT NULL,
    provider_ref TEXT,
    starts_at   TEXT NOT NULL,
    expires_at  TEXT,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id, kind);
`);

export function paymentsEnabled() {
  return String(process.env.PRELEGAL_PAYMENTS ?? 'off').toLowerCase() === 'on';
}

export function paymentProvider() {
  const name = String(process.env.PRELEGAL_PAYMENT_PROVIDER ?? '').toLowerCase();
  if (name === 'test' && process.env.NODE_ENV !== 'production') return 'test';
  return null; // no real provider connected yet
}

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

/** Save a completed payment. Called by the test provider now, and by a real provider's webhook later. */
export function recordPurchase(userId, { kind, documentId = null, planId = null, provider, providerRef = null, now = new Date() }) {
  let amount;
  let expiresAt = null;
  if (kind === 'plan') {
    const plan = PRICING.plans.find((p) => p.id === planId);
    if (!plan) throw Object.assign(new Error('Unknown plan.'), { status: 400 });
    amount = plan.price;
    // A new plan starts when any current plan ends, so buying early never loses time.
    const current = activePlan(userId, now);
    const start = current ? new Date(current.expiresAt) : now;
    expiresAt = addMonths(start, plan.months).toISOString();
  } else if (kind === 'document') {
    const row = db.prepare('SELECT spec_id FROM documents WHERE id = ? AND user_id = ?').get(documentId, userId);
    if (!row || !row.spec_id) throw Object.assign(new Error('Document not found.'), { status: 404 });
    amount = priceFor(row.spec_id).price;
  } else {
    throw Object.assign(new Error('Unknown purchase type.'), { status: 400 });
  }

  const purchase = {
    id: crypto.randomUUID(),
    user_id: userId,
    kind,
    document_id: kind === 'document' ? documentId : null,
    plan_id: kind === 'plan' ? planId : null,
    amount,
    currency: PRICING.currency,
    provider,
    provider_ref: providerRef,
    starts_at: now.toISOString(),
    expires_at: expiresAt,
    created_at: now.toISOString(),
  };
  db.prepare(
    `INSERT INTO purchases (id, user_id, kind, document_id, plan_id, amount, currency, provider, provider_ref, starts_at, expires_at, created_at)
     VALUES (@id, @user_id, @kind, @document_id, @plan_id, @amount, @currency, @provider, @provider_ref, @starts_at, @expires_at, @created_at)`,
  ).run(purchase);
  return { id: purchase.id, kind, documentId: purchase.document_id, planId: purchase.plan_id, amount, expiresAt };
}

/** The plan with the latest end date that hasn't ended yet, or null. */
export function activePlan(userId, now = new Date()) {
  const row = db
    .prepare(
      `SELECT plan_id, expires_at FROM purchases
       WHERE user_id = ? AND kind = 'plan' AND expires_at > ?
       ORDER BY expires_at DESC LIMIT 1`,
    )
    .get(userId, now.toISOString());
  return row ? { planId: row.plan_id, expiresAt: row.expires_at } : null;
}

/** Can this visitor download this document? Always yes while payments are off. */
export function canDownload(userId, documentId, now = new Date()) {
  if (!paymentsEnabled()) return { allowed: true, reason: 'payments-off' };
  if (activePlan(userId, now)) return { allowed: true, reason: 'plan' };
  const bought = db
    .prepare(`SELECT 1 FROM purchases WHERE user_id = ? AND kind = 'document' AND document_id = ?`)
    .get(userId, documentId);
  if (bought) return { allowed: true, reason: 'purchased' };
  return { allowed: false, reason: 'payment-required' };
}

/** What the page needs to show: whether payments are on, the visitor's plan, and what they've bought. */
export function entitlements(userId, now = new Date()) {
  const documents = db
    .prepare(`SELECT document_id FROM purchases WHERE user_id = ? AND kind = 'document'`)
    .all(userId)
    .map((r) => r.document_id);
  return {
    paymentsEnabled: paymentsEnabled(),
    providerConnected: Boolean(paymentProvider()),
    plan: activePlan(userId, now),
    documents,
  };
}

/** The options offered when a download needs payment. */
export function paymentOptions(specId) {
  const spec = getSpec(specId);
  const single = priceFor(specId);
  return {
    single: { label: `This ${spec.name}`, price: single.price, tier: single.tierName },
    plans: PRICING.plans.map((p) => ({ id: p.id, name: p.name, price: p.price, months: p.months })),
  };
}

/**
 * Start a checkout. With the test provider the purchase completes at once.
 * With no provider connected, the caller gets a clear 503.
 */
export function startCheckout(userId, { kind, documentId, planId }) {
  const provider = paymentProvider();
  if (!provider) {
    throw Object.assign(new Error('Payments are not connected yet. Please contact the help desk.'), { status: 503 });
  }
  // provider === 'test': simulate a successful payment.
  const purchase = recordPurchase(userId, { kind, documentId, planId, provider: 'test', providerRef: `test_${crypto.randomUUID()}` });
  return { status: 'paid', purchase };
}
