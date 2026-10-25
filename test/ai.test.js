// The AI layer without a model: tools, prompts and the fallback when the AI
// service is unreachable. The real model is graded by the evaluation (eval/).
import './helpers.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTools, toAction } from '../server/ai/tools.js';
import { SYSTEM_BASE, buildStateBlock } from '../server/ai/prompt.js';
import { DOCUMENT_SPECS } from '../server/documentSpecs.js';
import { execFileSync } from 'node:child_process';
import { ROOT_DIR } from '../server/config.js';

describe('tools offered to the model', () => {
  test('before a type is chosen, only set_document_type is offered', () => {
    assert.deepEqual(buildTools(null).map((t) => t.name), ['set_document_type']);
  });

  test('set_document_type only accepts the 11 supported agreements', () => {
    const ids = buildTools(null)[0].input_schema.properties.document_type_id.enum;
    assert.deepEqual(ids, DOCUMENT_SPECS.map((s) => s.id));
  });

  test("set_fields only accepts the chosen agreement's fields", () => {
    const tools = buildTools('mutual-nda');
    assert.deepEqual(tools.map((t) => t.name), ['set_document_type', 'set_fields', 'mark_complete']);
    const keys = tools[1].input_schema.properties.fields.items.properties.key.enum;
    assert.deepEqual(keys, DOCUMENT_SPECS[0].fields.map((f) => f.key));
  });

  test('malformed tool calls become harmless actions', () => {
    assert.deepEqual(toAction('set_fields', null), { type: 'set_fields', fields: {} });
    assert.deepEqual(toAction('set_fields', { fields: [{ key: 'party1', value: 42 }, { nope: 1 }, null] }), {
      type: 'set_fields',
      fields: { party1: '42' },
    });
    assert.equal(toAction('delete_everything', {}), null);
  });
});

describe('prompts', () => {
  test('the interviewer is told to ask one question at a time', () => {
    assert.match(SYSTEM_BASE, /One question at a time/);
    assert.match(SYSTEM_BASE, /sees ONLY your latest message/);
  });

  test('the interviewer must not invent values or fake unsupported documents', () => {
    assert.match(SYSTEM_BASE, /never invent a value/);
    assert.match(SYSTEM_BASE, /Never pretend an unsupported document is supported/);
    assert.match(SYSTEM_BASE, /not a lawyer and this is not legal advice/);
  });

  test('the state block names the next required field', () => {
    const block = buildStateBlock('mutual-nda', { party1: 'Duck LLC' });
    assert.match(block, /`party1` \(required, SET to "Duck LLC"\)/);
    assert.match(block, /Ask about `party2` next/);
  });
});

describe('when the AI service is down', () => {
  // Run in a child process with a key set and OpenRouter pointed at a closed
  // port, so the real provider fails fast without touching the network.
  const script = `
    const { startServer, Client } = await import('./test/helpers.js');
    const srv = await startServer();
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    const kick = await c.post('/api/documents/' + doc.id + '/messages', { kickoff: true });
    const support = await c.post('/api/support/chat', { messages: [{ role: 'user', content: 'How do I download?' }] });
    await srv.close();
    console.log(JSON.stringify({ kick: kick.status, degraded: kick.data.degraded, text: kick.data.messages[0].content,
      support: support.status, supportText: support.data.text }));
  `;

  test('the interview falls back to the scripted interviewer and the support chat to scripted answers', () => {
    const out = execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        PRELEGAL_AI_MODE: '',
        OPENROUTER_API_KEY: 'test-key-not-real',
        OPENROUTER_BASE_URL: 'http://127.0.0.1:9/api/v1',
      },
    });
    const r = JSON.parse(out.trim().split('\n').pop());
    assert.equal(r.kick, 200);
    assert.equal(r.degraded, true);
    assert.match(r.text, /AI service is unavailable/);
    assert.match(r.text, /Party 1 name/);
    assert.equal(r.support, 200);
    assert.match(r.supportText, /Download/);
  });
});
