/**
 * A minimal in-memory rate limiter, keyed by client IP.
 *
 * This is a single-process, in-memory demo guard — it resets on restart and
 * doesn't share state across multiple server instances. That's fine for the
 * shared demo login this app runs with; it would need a real store (Redis,
 * etc.) to hold up behind more than one process.
 */

const buckets = new Map(); // ip -> timestamps[]

/**
 * The demo limits are on unless PRELEGAL_DEMO_LIMITS=off. Only the evaluation
 * runner and local test sessions switch them off; never do that in production.
 */
export function limitsEnabled() {
  return String(process.env.PRELEGAL_DEMO_LIMITS ?? 'on').toLowerCase() !== 'off';
}

/** Forget every counter. For tests only. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * @param {string} key            Usually the client IP.
 * @param {number} maxPerWindow   Max allowed hits within the window.
 * @param {number} windowMs       Rolling window length, in milliseconds.
 * @returns {{allowed: boolean, retryAfterMinutes?: number}}
 */
export function checkRateLimit(key, maxPerWindow, windowMs) {
  if (!limitsEnabled()) return { allowed: true };
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= maxPerWindow) {
    const retryAfterMs = windowMs - (now - hits[0]);
    buckets.set(key, hits);
    return { allowed: false, retryAfterMinutes: Math.max(1, Math.ceil(retryAfterMs / 60000)) };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true };
}
