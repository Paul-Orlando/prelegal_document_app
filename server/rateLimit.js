/**
 * A minimal in-memory rate limiter, keyed by client IP.
 *
 * This is a single-process, in-memory demo guard — it resets on restart and
 * doesn't share state across multiple server instances. That's fine for the
 * shared demo login this app runs with; it would need a real store (Redis,
 * etc.) to hold up behind more than one process.
 */

const buckets = new Map(); // key -> timestamps[]

const HOUR = 60 * 60 * 1000;

/**
 * Every demo limit in one place. A "visitor" is one browser (its guest
 * session); the per-address backstop stops cookie-clearing and private windows
 * from giving unlimited tries, and is set higher because offices and cafes
 * share one address.
 */
export const LIMITS = {
  documentsPerVisitor: { max: 2, windowMs: HOUR },
  documentsPerAddress: { max: 6, windowMs: HOUR },
  answersPerDocument: 40, // a full interview takes 10–20
  supportPerVisitor: { max: 20, windowMs: HOUR },
  supportPerAddress: { max: 60, windowMs: HOUR },
};

/** "about 1 minute" / "about 23 minutes" */
export const minutesText = (n) => `about ${n} minute${n === 1 ? '' : 's'}`;

/**
 * The demo limits are on unless PRELEGAL_DEMO_LIMITS=off. Only the evaluation
 * runner and local test sessions switch them off; never do that in production.
 */
export function limitsEnabled() {
  return String(process.env.PRELEGAL_DEMO_LIMITS ?? 'on').toLowerCase() !== 'off';
}

/**
 * Check several limits together and count the request against all of them only
 * if every one allows it, so a refused request never uses up anyone's allowance.
 * @param {{key: string, max: number, windowMs: number}[]} checks
 * @returns {{allowed: boolean, retryAfterMinutes?: number, which?: string}}
 */
export function checkLimits(checks) {
  if (!limitsEnabled()) return { allowed: true };
  const now = Date.now();
  for (const c of checks) {
    const hits = (buckets.get(c.key) ?? []).filter((t) => now - t < c.windowMs);
    buckets.set(c.key, hits);
    if (hits.length >= c.max) {
      const retryAfterMs = c.windowMs - (now - hits[0]);
      return { allowed: false, retryAfterMinutes: Math.max(1, Math.ceil(retryAfterMs / 60000)), which: c.key };
    }
  }
  for (const c of checks) buckets.get(c.key).push(now);
  return { allowed: true };
}

/**
 * Give back one use of a limit, most recent first. Used when someone discards
 * a draft they never answered anything in (they changed their mind about the
 * agreement type). Only the per-visitor counter is refunded; the per-address
 * backstop never is, so this can't be used to get unlimited documents.
 */
export function refundLimit(key) {
  const hits = buckets.get(key);
  if (hits?.length) hits.pop();
}

/** Forget every counter. For tests only. */
export function resetRateLimits() {
  buckets.clear();
}

