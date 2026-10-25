// Checks the evaluation set for free (no model): every question is well formed,
// every expected fact is backed by the app's own data, and the grader works.
import './helpers.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOCUMENT_SPECS, getSpec } from '../server/documentSpecs.js';
import { firmSummary } from '../server/firm.js';
import { pricingSummary } from '../server/pricing.js';
import { contains, grade, norm } from '../eval/grade.mjs';

const { questions } = JSON.parse(fs.readFileSync(new URL('../eval/questions.json', import.meta.url), 'utf8'));
const GROUPS = ['interview', 'guardrails', 'recommend', 'app-and-firm', 'pricing', 'handoff', 'context'];

// What the assistant is told: the source every expected fact must come from.
const KNOWLEDGE = [
  firmSummary(),
  pricingSummary(),
  ...DOCUMENT_SPECS.flatMap((s) => [s.name, s.description, ...(s.aliases ?? [])]),
].join('\n');

describe('evaluation set', () => {
  test('ids are unique and every question has a known group and kind', () => {
    const ids = questions.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const q of questions) {
      assert.ok(GROUPS.includes(q.group), `${q.id}: group ${q.group}`);
      assert.ok(['interview', 'support'].includes(q.kind), q.id);
    }
    assert.ok(questions.length >= 40);
  });

  test('every question checks something', () => {
    for (const q of questions) {
      const checks = ['expect_facts', 'expect_words', 'forbid', 'expect_values', 'expect_empty', 'forbid_values', 'expect_status', 'expect_escalate', 'expect_pricing'];
      assert.ok(checks.some((k) => q[k] !== undefined && (!Array.isArray(q[k]) || q[k].length)), q.id);
    }
  });

  test('interview questions use real agreements and real field names', () => {
    for (const q of questions.filter((x) => x.kind === 'interview')) {
      const spec = getSpec(q.spec);
      assert.ok(spec, `${q.id}: unknown agreement ${q.spec}`);
      const keys = new Set(spec.fields.map((f) => f.key));
      for (const k of [...Object.keys(q.prefill ?? {}), ...Object.keys(q.expect_values ?? {}), ...(q.expect_empty ?? [])]) {
        assert.ok(keys.has(k), `${q.id}: ${q.spec} has no field ${k}`);
      }
      assert.ok(Array.isArray(q.turns), `${q.id}: turns`);
      for (const k of Object.keys(q.expect_values ?? {})) {
        assert.ok(!(k in (q.prefill ?? {})) || q.turns.length, `${q.id}: ${k} is only prefilled`);
      }
    }
  });

  test('support questions have at least one message', () => {
    for (const q of questions.filter((x) => x.kind === 'support')) {
      assert.ok(q.messages?.length && q.messages.every((m) => typeof m === 'string' && m.trim()), q.id);
    }
  });

  test("every expected fact is in the app's own data, so the set can't drift from it", () => {
    for (const q of questions) {
      for (const group of q.expect_facts ?? []) {
        assert.ok(group.some((alt) => contains(KNOWLEDGE, alt)), `${q.id}: none of ${JSON.stringify(group)} is in the app data`);
      }
    }
  });

  test('a default the set relies on is the real default', () => {
    const purpose = getSpec('mutual-nda').fields.find((f) => f.key === 'purpose').default;
    const q = questions.find((x) => x.id === 'rec-03');
    assert.ok(q.expect_values.purpose.some((alt) => contains(purpose, alt)));
  });

  test('prices the set expects match the price list', () => {
    const q = (id) => questions.find((x) => x.id === id);
    assert.ok(contains(pricingSummary(), '$49') && q('sup-price-01').expect_facts[0].includes('$49'));
    assert.ok(q('sup-price-02').expect_facts.flat().every((p) => contains(pricingSummary(), p)));
  });
});

describe('grader', () => {
  test('matching ignores case, dollar signs, commas and dash styles', () => {
    assert.equal(norm('The FEE is $1,200 — monthly'), 'the fee is 1200 - monthly');
    assert.ok(contains('It costs $49.', '$49'));
    assert.ok(contains('Duck LLC’s NDA', "duck llc's"));
  });

  test('numbers match whole: 49 does not match 249 or 4.49', () => {
    assert.ok(!contains('The plan is $249.', '$49'));
    assert.ok(!contains('About $4.49', '49'));
    assert.ok(contains('Plans from $249 or $49 each.', '$49'));
  });

  test('phone numbers match by digits in any format', () => {
    assert.ok(contains('Call 404-555-0142 today', '(404) 555-0142'));
    assert.ok(contains('Call (404) 555 0142', '(404) 555-0142'));
    assert.ok(!contains('Call (404) 555-0199', '(404) 555-0142'));
  });

  test('an interview run passes only when the right values are saved', () => {
    const q = questions.find((x) => x.id === 'rec-02');
    const good = { reply: 'Got it. What is the purpose?', values: { party1: 'Duck LLC', party2: 'Dogs LLC', governingLaw: 'Delaware' }, specId: 'mutual-nda', status: 'draft' };
    assert.equal(grade(q, good).pass, true);
    const raw = { ...good, values: { party1: 'Duck LLC', party2: 'The other side is Dogs LLC, and we will use Delaware law.' } };
    const g = grade(q, raw);
    assert.equal(g.pass, false);
    assert.match(g.failures.join(), /governingLaw not saved/);
  });

  test('changing the agreement type fails the run', () => {
    const q = questions.find((x) => x.id === 'grd-01');
    const g = grade(q, { reply: "Sorry, I can't do that.", values: { party1: 'Duck LLC' }, specId: 'pilot-agreement', status: 'draft' });
    assert.match(g.failures.join(), /agreement type changed/);
  });

  test('style: more than two questions or 110 words fails', () => {
    const q = questions.find((x) => x.id === 'start-01');
    const base = { values: {}, specId: 'mutual-nda', status: 'draft' };
    assert.equal(grade(q, { ...base, reply: 'What is the legal name of Party 1?' }).pass, true);
    assert.match(grade(q, { ...base, reply: 'Party 1? Party 2? Purpose?' }).failures.join(), /3 questions/);
    assert.match(grade(q, { ...base, reply: `Party 1 ${'word '.repeat(120)}?` }).failures.join(), /words/);
  });

  test('handoff and pricing: required, forbidden, or optional', () => {
    const hand = questions.find((x) => x.id === 'sup-hand-01');
    assert.equal(grade(hand, { reply: 'Call (404) 555-0199.', escalate: true, showPricing: false }).pass, true);
    assert.match(grade(hand, { reply: 'Call (404) 555-0199.', escalate: false }).failures.join(), /handoff/);

    const app = questions.find((x) => x.id === 'sup-app-01');
    assert.match(grade(app, { reply: 'Press Download.', escalate: true, showPricing: false }).failures.join(), /handoff: not expected/);

    const lifetime = questions.find((x) => x.id === 'sup-price-06');
    assert.equal(grade(lifetime, { reply: "We don't offer that.", escalate: true, showPricing: true }).pass, true);
    assert.equal(grade(lifetime, { reply: 'Use code SAVE20 for 20% off.', escalate: false }).pass, false);
  });
});
