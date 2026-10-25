// The document model behind both exports: clause numbering, key terms, and
// clean text from the Common Paper templates.
import './helpers.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocModel, parseTerms, plainText } from '../server/docModel.js';
import { DOCUMENT_SPECS } from '../server/documentSpecs.js';

describe('Standard Terms parsing', () => {
  test('nested clauses are numbered 1. / 1.1 / (a)', () => {
    const terms = buildDocModel('cloud-service-agreement').terms;
    const labels = terms.filter((b) => b.type === 'clause').map((b) => b.label);
    assert.equal(labels[0], '1.');
    assert.equal(labels[1], '1.1');
    const i = labels.indexOf('2.1');
    assert.deepEqual(labels.slice(i, i + 3), ['2.1', '(a)', '(b)']);
    assert.equal(terms[0].isHeading, true);
  });

  test('a clause number never repeats within its section (DPA multi-paragraph items)', () => {
    for (const spec of DOCUMENT_SPECS) {
      const clauses = buildDocModel(spec.id).terms.filter((b) => b.type === 'clause' && b.label && b.level < 2);
      const seen = new Set();
      for (const c of clauses) {
        assert.ok(!seen.has(c.label), `${spec.id}: ${c.label} repeated`);
        seen.add(c.label);
      }
    }
  });

  test('every agreement parses into clean text', () => {
    for (const spec of DOCUMENT_SPECS) {
      const { terms } = buildDocModel(spec.id);
      assert.ok(terms.filter((b) => b.type === 'clause').length >= 5, spec.id);
      for (const b of terms) {
        const text = plainText(b.runs);
        assert.doesNotMatch(text, /\*\*|<\/?span|[​-‏﻿]/, `${spec.id}: ${text.slice(0, 60)}`);
        assert.ok(text.trim().length > 0, `${spec.id}: empty block`);
      }
    }
  });

  test('bold clause titles survive as bold runs', () => {
    const first = buildDocModel('mutual-nda').terms[0];
    assert.equal(first.label, '1.');
    assert.equal(first.runs[0].text, 'Introduction');
    assert.equal(first.runs[0].bold, true);
  });

  test('lettered continuation lines become sub-clauses', () => {
    const blocks = parseTerms('1. Title\n    1. Item.\n        a. First.\n        b. Second.\n');
    assert.deepEqual(blocks.map((b) => b.label), ['1.', '1.1', '(a)', '(b)']);
  });
});

describe('key terms', () => {
  const mnda = DOCUMENT_SPECS.find((s) => s.id === 'mutual-nda');

  test('given values are used, dates are written out', () => {
    const m = buildDocModel('mutual-nda', { party1: 'Duck LLC', effectiveDate: '2026-11-01' });
    assert.equal(m.keyTerms.find((k) => k.label === 'Party 1 name').value, 'Duck LLC');
    assert.equal(m.keyTerms.find((k) => k.label === 'Effective date').value, 'November 1, 2026');
    assert.equal(m.effectiveDate, 'November 1, 2026');
  });

  test('blank required terms are outstanding; defaults fill in where they exist', () => {
    const m = buildDocModel('mutual-nda', {});
    assert.equal(m.keyTerms.find((k) => k.label === 'Party 1 name').value, null);
    assert.match(m.keyTerms.find((k) => k.label === 'Purpose').value, /business relationship/);
    assert.equal(m.isDraft, true);
    assert.equal(m.missingCount, mnda.fields.filter((f) => f.required).length);
  });

  test('blank notice addresses stay "to be completed", not "None"', () => {
    const m = buildDocModel('mutual-nda', {});
    assert.equal(m.keyTerms.find((k) => k.label === 'Party 1 notice address').value, null);
  });

  test('the party names come from the right fields per agreement', () => {
    assert.deepEqual(buildDocModel('mutual-nda', { party1: 'A', party2: 'B' }).parties, ['A', 'B']);
    assert.deepEqual(buildDocModel('cloud-service-agreement', { provider: 'P', customer: 'C' }).parties, ['P', 'C']);
    assert.deepEqual(buildDocModel('cloud-service-agreement', {}).parties, ['Provider', 'Customer']);
  });

  test('every model carries the Common Paper attribution', () => {
    for (const spec of DOCUMENT_SPECS) {
      assert.match(buildDocModel(spec.id).attribution, /Common Paper .*CC BY 4\.0/, spec.id);
    }
  });
});
