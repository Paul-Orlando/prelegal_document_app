// The one-question-at-a-time interview, using the scripted interviewer so it
// runs without an API key. The real model is graded by the evaluation (eval/).
import { Client, startServer } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.close());

async function started(specId = 'mutual-nda') {
  const c = new Client(srv.base);
  const doc = await c.newDocument(specId);
  const kick = await c.post(`/api/documents/${doc.id}/messages`, { kickoff: true });
  return { c, doc, kick };
}

const send = (c, doc, content) => c.post(`/api/documents/${doc.id}/messages`, { content });

describe('starting a document', () => {
  test('picking an agreement asks the first question', async () => {
    const { kick } = await started();
    assert.equal(kick.status, 200);
    assert.equal(kick.data.messages.length, 1, 'only the assistant message comes back');
    assert.equal(kick.data.messages[0].role, 'assistant');
    assert.match(kick.data.messages[0].content, /Mutual Non-Disclosure Agreement/);
    assert.match(kick.data.messages[0].content, /Party 1 name/);
  });

  test('the hidden start instruction is never saved as something the user said', async () => {
    const { c, doc } = await started();
    const { data } = await c.get(`/api/documents/${doc.id}`);
    assert.ok(data.messages.every((m) => m.role === 'assistant'));
  });

  test("starting needs an agreement type", async () => {
    const c = new Client(srv.base);
    const { data } = await c.post('/api/documents', {});
    const res = await c.post(`/api/documents/${data.document.id}/messages`, { kickoff: true });
    assert.equal(res.status, 400);
  });

  test('every agreement type starts with a question', async () => {
    const { DOCUMENT_SPECS } = await import('../server/documentSpecs.js');
    const c = new Client(srv.base, { ip: '10.1.0.1' });
    for (const spec of DOCUMENT_SPECS) {
      const doc = await c.newDocument(spec.id);
      const res = await c.post(`/api/documents/${doc.id}/messages`, { kickoff: true });
      assert.equal(res.status, 200, spec.id);
      const first = spec.fields.find((f) => f.required);
      assert.match(res.data.messages[0].content, new RegExp(first.label), spec.id);
    }
  });
});

describe('answering questions', () => {
  test('an answer is recorded on the document and the next question follows', async () => {
    const { c, doc } = await started();
    const res = await send(c, doc, 'Duck LLC, a Delaware limited liability company');
    assert.equal(res.status, 200);
    assert.equal(res.data.document.values.party1, 'Duck LLC, a Delaware limited liability company');
    const reply = res.data.messages.at(-1).content;
    assert.match(reply, /Party 2 name/);
    assert.deepEqual(res.data.meta.actions, ['set_fields']);
  });

  test('a required question cannot be skipped', async () => {
    const { c, doc } = await started();
    const res = await send(c, doc, 'skip');
    assert.equal(res.data.document.values.party1, undefined);
    assert.match(res.data.messages.at(-1).content, /required/);
  });

  test('"yes" accepts the suggested default', async () => {
    const { c, doc } = await started();
    await send(c, doc, 'Duck LLC');
    await send(c, doc, 'Dogs LLC');
    const res = await send(c, doc, 'yes');
    assert.equal(
      res.data.document.values.purpose,
      'Evaluating whether to enter into a business relationship with the other party.',
    );
  });

  test('a full interview completes the document and "done" finishes it', async () => {
    const { c, doc } = await started();
    const answers = ['Duck LLC', 'Dogs LLC', 'yes', '2026-11-01', 'yes', '3 years', 'Delaware', 'courts in New Castle County, Delaware'];
    let res;
    for (const a of answers) res = await send(c, doc, a);
    assert.equal(res.data.document.isComplete, true);
    assert.equal(res.data.document.status, 'draft');
    res = await send(c, doc, 'done');
    assert.equal(res.data.document.status, 'complete');
    assert.match(res.data.messages.at(-1).content, /ready to download/);
  });

  test('both sides of the conversation are kept for the AI, in order', async () => {
    const { c, doc } = await started();
    await send(c, doc, 'Duck LLC');
    const { data } = await c.get(`/api/documents/${doc.id}`);
    assert.deepEqual(data.messages.map((m) => m.role), ['assistant', 'user', 'assistant']);
  });

  test('empty and oversized messages are rejected', async () => {
    const { c, doc } = await started();
    assert.equal((await send(c, doc, '   ')).status, 400);
    assert.equal((await send(c, doc, 'x'.repeat(8001))).status, 400);
  });
});
