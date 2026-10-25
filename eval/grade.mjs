/**
 * Grading for the assistant evaluation. Pure functions: no model, no network,
 * so the same rules run in the evaluation, in --rescore, and in the free tests.
 *
 * A run passes when every check that applies to the question passes:
 *   facts     every expect_facts group has at least one alternative in the reply (data from the app)
 *   words     every expect_words group has at least one alternative in the reply (wording)
 *   forbid    nothing in forbid appears in the reply
 *   state     interview only: expected values saved, expected-empty fields empty, no forbidden
 *             values, the agreement type unchanged, and the expected status
 *   handoff   support only: help desk handoff when expected, and only then ("optional" accepts both)
 *   pricing   support only: the View plans button when expected, and only then ("optional" accepts both)
 *   style     interview only: at most 2 questions and 110 words, so it stays one question at a time
 */

export const LIMITS = { maxQuestions: 2, maxWords: 110, slowMs: 8000 };

/** Lowercase, straighten quotes and dashes, drop dollar signs and thousands commas, collapse spaces. */
export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\$/g, '')
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const digits = (s) => String(s).replace(/\D/g, '');
const isPhone = (alt) => /^[\d\s().+-]+$/.test(alt) && digits(alt).length >= 7;

/** Does `text` contain `alt`? Whole words and whole numbers only (49 doesn't match 249); phone numbers by digits. */
export function contains(text, alt) {
  if (isPhone(alt)) return digits(text).includes(digits(alt));
  const t = norm(text);
  const a = norm(alt);
  if (!a) return false;
  return new RegExp(`(?<![\\w.])${escapeRe(a)}(?![\\w])`).test(t);
}

const anyOf = (text, group) => group.some((alt) => contains(text, alt));
const wordCount = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
const questionCount = (s) => (String(s).match(/\?/g) || []).length;

/**
 * Grade one run.
 * @param {object} q        the question
 * @param {object} r        what happened: { reply, values, status, specId, escalate, showPricing }
 * @returns {{ pass: boolean, checks: Record<string, boolean|null>, failures: string[] }}
 */
export function grade(q, r) {
  const reply = r.reply ?? '';
  const checks = {};
  const failures = [];
  const fail = (check, why) => {
    checks[check] = false;
    failures.push(`${check}: ${why}`);
  };

  // facts and words
  for (const [check, groups] of [['facts', q.expect_facts], ['words', q.expect_words]]) {
    if (!groups?.length) { checks[check] = null; continue; }
    checks[check] = true;
    for (const g of groups) if (!anyOf(reply, g)) fail(check, `missing one of ${JSON.stringify(g)}`);
  }

  // forbid
  if (q.forbid?.length) {
    checks.forbid = true;
    for (const f of q.forbid) {
      if (norm(reply).includes(norm(f)) && (norm(f) !== '' )) fail('forbid', `contains ${JSON.stringify(f)}`);
    }
  } else checks.forbid = null;

  if (q.kind === 'interview') {
    const values = r.values ?? {};
    checks.state = true;
    for (const [key, alts] of Object.entries(q.expect_values ?? {})) {
      const v = values[key];
      if (!v || !String(v).trim()) fail('state', `${key} not saved`);
      else if (!alts.some((a) => contains(v, a) || norm(v) === norm(a))) fail('state', `${key} saved as ${JSON.stringify(v)}`);
    }
    for (const key of q.expect_empty ?? []) {
      const v = values[key];
      if (v && String(v).trim()) fail('state', `${key} should be empty, got ${JSON.stringify(v)}`);
    }
    for (const bad of q.forbid_values ?? []) {
      for (const [key, v] of Object.entries(values)) {
        if (norm(v) === norm(bad)) fail('state', `${key} set to ${JSON.stringify(v)}`);
      }
    }
    if (r.specId !== q.spec) fail('state', `agreement type changed to ${r.specId}`);
    if (q.expect_status && r.status !== q.expect_status) fail('state', `status ${r.status}, expected ${q.expect_status}`);

    checks.style = true;
    const qs = questionCount(reply);
    const wc = wordCount(reply);
    if (qs > LIMITS.maxQuestions) fail('style', `${qs} questions in one reply`);
    if (wc > LIMITS.maxWords) fail('style', `${wc} words`);
    checks.handoff = null;
    checks.pricing = null;
  } else {
    checks.state = null;
    checks.style = null;
    for (const [check, expected, actual] of [
      ['handoff', q.expect_escalate ?? false, Boolean(r.escalate)],
      ['pricing', q.expect_pricing ?? false, Boolean(r.showPricing)],
    ]) {
      if (expected === 'optional') { checks[check] = null; continue; }
      checks[check] = true;
      if (actual !== expected) fail(check, expected ? 'expected it, but none' : 'not expected, but given');
    }
  }

  return { pass: failures.length === 0, checks, failures };
}
