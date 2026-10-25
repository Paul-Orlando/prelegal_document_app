/**
 * Assistant evaluation runner.
 *
 * Asks every question in eval/questions.json through the real app (in-process,
 * with a throwaway database), grades each run with eval/grade.mjs, and writes
 * eval/results/<date>_<model>[_<label>].csv (one row per run) and .md (summary
 * and every failure with the answer given).
 *
 * This calls the real model, so it costs money; it isn't part of `npm test`.
 * The key comes from OPENROUTER_API_KEY (the app also reads it from .env).
 *
 *   npm run eval -- --limit 3 --runs 1          smoke test: 3 questions, 1 run (about $0.01)
 *   npm run eval                                all questions, 3 runs each
 *   npm run eval -- --group pricing             one group
 *   npm run eval -- --only rec-02 sup-price-04  chosen questions
 *   npm run eval -- --model anthropic/claude-haiku-4.5 --label haiku
 *   npm run eval -- --mock --runs 1             check the runner itself with the scripted stand-in (free)
 *   npm run eval -- --rescore eval/results/<file>.csv   re-grade saved answers, no model calls
 *
 * Prices for the cost estimate come from OpenRouter's public model list (no key
 * sent); --price-in / --price-out (USD per 1M tokens) override them.
 * The per-visitor demo limits are switched off for the run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITS, grade } from './grade.mjs';

const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(EVAL_DIR, 'results');
const QUESTIONS = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, 'questions.json'), 'utf8')).questions;

// Fallback prices (USD per 1M input, output tokens) when OpenRouter's list can't be reached.
const FALLBACK_PRICES = { 'openai/gpt-4o-mini': [0.15, 0.6] };

/* ------------------------------------------------------------------ args */

function parseArgs(argv) {
  const a = { runs: 3, limit: null, only: [], group: null, model: null, label: '', mock: false, rescore: null, priceIn: null, priceOut: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--runs') a.runs = Number(next());
    else if (k === '--limit') a.limit = Number(next());
    else if (k === '--group') a.group = next();
    else if (k === '--model') a.model = next();
    else if (k === '--label') a.label = next();
    else if (k === '--mock') a.mock = true;
    else if (k === '--rescore') a.rescore = next();
    else if (k === '--price-in') a.priceIn = Number(next());
    else if (k === '--price-out') a.priceOut = Number(next());
    else if (k === '--only') while (argv[i + 1] && !argv[i + 1].startsWith('--')) a.only.push(argv[++i]);
    else if (k === '--help' || k === '-h') a.help = true;
    else throw new Error(`Unknown option ${k}. Use --help.`);
  }
  return a;
}

/* ------------------------------------------------------------- secrets */

const KEYLIKE = /(Bearer\s+)\S+|sk-or-[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,}/gi;
/** Remove the API key, and anything that looks like one, from text we print or save. */
function scrub(text) {
  let s = String(text ?? '');
  const key = process.env.OPENROUTER_API_KEY;
  if (key) s = s.split(key).join('[key removed]');
  return s.replace(KEYLIKE, (_m, bearer) => `${bearer || ''}[key removed]`);
}

/* ---------------------------------------------------------------- csv */

const CSV_COLS = [
  'id', 'group', 'kind', 'run', 'pass', 'facts', 'words', 'forbid', 'state', 'handoff', 'pricing', 'style',
  'failures', 'seconds', 'slow', 'actions', 'input_tokens', 'output_tokens', 'cost_usd',
  'status', 'spec_id', 'escalate', 'show_pricing', 'values_json', 'reply',
];

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/* -------------------------------------------------------------- prices */

async function modelPrices(model, args) {
  if (args.priceIn != null && args.priceOut != null) return [args.priceIn, args.priceOut, 'given'];
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(8000) });
    const list = (await res.json()).data ?? [];
    const m = list.find((x) => x.id === model);
    if (m?.pricing) return [Number(m.pricing.prompt) * 1e6, Number(m.pricing.completion) * 1e6, 'OpenRouter list'];
  } catch {
    /* fall through */
  }
  const fb = FALLBACK_PRICES[model];
  return fb ? [...fb, 'built-in fallback'] : [0, 0, 'unknown (cost not estimated)'];
}

/* ---------------------------------------------------------------- run */

async function askOne(Client, base, q) {
  const c = new Client(base);
  const usage = { inputTokens: 0, outputTokens: 0 };
  const actions = [];
  const add = (meta) => {
    usage.inputTokens += meta?.usage?.inputTokens ?? 0;
    usage.outputTokens += meta?.usage?.outputTokens ?? 0;
    actions.push(...(meta?.actions ?? []));
  };
  let reply = '';
  let seconds = 0;

  if (q.kind === 'interview') {
    const doc = await c.newDocument(q.spec);
    if (q.prefill) await c.patch(`/api/documents/${doc.id}`, { values: q.prefill });
    const steps = [{ kickoff: true }, ...(q.turns ?? []).map((content) => ({ content }))];
    let last;
    for (const body of steps) {
      const t0 = performance.now();
      last = await c.post(`/api/documents/${doc.id}/messages`, body);
      seconds = (performance.now() - t0) / 1000;
      if (last.status !== 200) throw new Error(`HTTP ${last.status}: ${JSON.stringify(last.data)}`);
      add(last.data.meta);
    }
    reply = last.data.messages.at(-1).content;
    const d = last.data.document;
    return { reply, values: d.values, status: d.status, specId: d.specId, seconds, usage, actions };
  }

  const messages = [];
  let res;
  for (const content of q.messages) {
    messages.push({ role: 'user', content });
    const t0 = performance.now();
    res = await c.post('/api/support/chat', { messages, ...(q.context ? { context: q.context } : {}) });
    seconds = (performance.now() - t0) / 1000;
    if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    add(res.data.meta);
    messages.push({ role: 'assistant', content: res.data.text });
  }
  return { reply: res.data.text, escalate: res.data.escalate, showPricing: res.data.showPricing, seconds, usage, actions };
}

function toRow(q, run, r, g, prices) {
  const cost = (r.usage.inputTokens * prices[0] + r.usage.outputTokens * prices[1]) / 1e6;
  const ck = (k) => (g.checks[k] === null || g.checks[k] === undefined ? '' : g.checks[k] ? 'pass' : 'FAIL');
  return {
    id: q.id, group: q.group, kind: q.kind, run, pass: g.pass ? 'pass' : 'FAIL',
    facts: ck('facts'), words: ck('words'), forbid: ck('forbid'), state: ck('state'),
    handoff: ck('handoff'), pricing: ck('pricing'), style: ck('style'),
    failures: g.failures.join('; '), seconds: r.seconds.toFixed(2), slow: r.seconds > LIMITS.slowMs / 1000 ? 'slow' : '',
    actions: r.actions.join(' '), input_tokens: r.usage.inputTokens, output_tokens: r.usage.outputTokens,
    cost_usd: cost.toFixed(6), status: r.status ?? '', spec_id: r.specId ?? '',
    escalate: r.escalate === undefined ? '' : String(r.escalate), show_pricing: r.showPricing === undefined ? '' : String(r.showPricing),
    values_json: r.values ? JSON.stringify(r.values) : '', reply: scrub(r.reply),
  };
}

/* ------------------------------------------------------------- report */

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(0)}%` : 'n/a');
const p95 = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
};

function writeReport(rows, { model, prices, runs, file, mode }) {
  const byQ = new Map();
  for (const r of rows) byQ.set(r.id, [...(byQ.get(r.id) ?? []), r]);
  const passed = rows.filter((r) => r.pass === 'pass').length;
  const consistent = [...byQ.values()].filter((rs) => rs.every((r) => r.pass === 'pass')).length;
  const secs = rows.map((r) => Number(r.seconds));
  const cost = rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0);

  const groups = [...new Set(rows.map((r) => r.group))];
  const groupLines = groups.map((g) => {
    const rs = rows.filter((r) => r.group === g);
    const qs = [...byQ.entries()].filter(([, v]) => v[0].group === g);
    return `| ${g} | ${qs.length} | ${pct(rs.filter((r) => r.pass === 'pass').length, rs.length)} | ${qs.filter(([, v]) => v.every((r) => r.pass === 'pass')).length} of ${qs.length} |`;
  });

  const checkNames = ['facts', 'words', 'forbid', 'state', 'handoff', 'pricing', 'style'];
  const checkLines = checkNames.map((k) => {
    const applied = rows.filter((r) => r[k]);
    return `| ${k} | ${applied.length} | ${pct(applied.filter((r) => r[k] === 'pass').length, applied.length)} |`;
  });

  const handoffRows = rows.filter((r) => r.handoff);
  const fails = rows.filter((r) => r.pass !== 'pass');
  const slow = rows.filter((r) => r.slow);

  const md = [
    `# Assistant evaluation: ${model}`,
    '',
    `${new Date().toISOString().slice(0, 10)} · ${mode} · ${byQ.size} questions × ${runs} run${runs === 1 ? '' : 's'} = ${rows.length} runs`,
    '',
    '## Summary',
    '',
    '| Measure | Result |',
    '|---|---|',
    `| Runs passed | **${passed} of ${rows.length} (${pct(passed, rows.length)})** |`,
    `| Questions passed on every run (consistency) | ${consistent} of ${byQ.size} (${pct(consistent, byQ.size)}) |`,
    `| Help desk handoff correct | ${handoffRows.length ? `${handoffRows.filter((r) => r.handoff === "pass").length} of ${handoffRows.length} graded runs` : "not graded in this run"} |`,
    `| Time per graded reply | average ${(secs.reduce((a, b) => a + b, 0) / (secs.length || 1)).toFixed(1)} s, 95th percentile ${p95(secs).toFixed(1)} s |`,
    `| Slow replies (over ${LIMITS.slowMs / 1000} s, flagged, not failed) | ${slow.length} |`,
    `| Estimated cost | $${cost.toFixed(4)} total, $${(cost / (rows.length || 1)).toFixed(5)} per run (prices: ${prices[2]}) |`,
    '',
    '## By group',
    '',
    '| Group | Questions | Runs passed | Passed every run |',
    '|---|---|---|---|',
    ...groupLines,
    '',
    '## By check',
    '',
    '| Check | Runs graded | Passed |',
    '|---|---|---|',
    ...checkLines,
    '',
    `## Failures (${fails.length})`,
    '',
    ...(fails.length
      ? fails.flatMap((r) => [
          `### ${r.id} (run ${r.run})`,
          '',
          `- ${r.failures.split('; ').join('\n- ')}`,
          ...(r.values_json ? [`- Saved values: \`${r.values_json}\``] : []),
          '',
          '> ' + r.reply.replace(/\n+/g, ' ').slice(0, 500),
          '',
        ])
      : ['None.', '']),
  ].join('\n');

  fs.writeFileSync(file.replace(/\.csv$/, '.md'), md);
  return { passed, total: rows.length, consistent, questions: byQ.size, cost };
}

function writeCsv(rows, file) {
  fs.writeFileSync(file, [CSV_COLS.join(','), ...rows.map((r) => CSV_COLS.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
}

/* ---------------------------------------------------------------- main */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
    return;
  }
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

  // Re-grade saved answers with the current rules: no model calls.
  if (args.rescore) {
    const src = path.resolve(args.rescore);
    const old = parseCsv(fs.readFileSync(src, 'utf8'));
    const rows = old.map((o) => {
      const q = byId.get(o.id);
      if (!q) throw new Error(`Question ${o.id} is no longer in questions.json`);
      const r = {
        reply: o.reply,
        values: o.values_json ? JSON.parse(o.values_json) : undefined,
        status: o.status || undefined,
        specId: o.spec_id || undefined,
        escalate: o.escalate === '' ? undefined : o.escalate === 'true',
        showPricing: o.show_pricing === '' ? undefined : o.show_pricing === 'true',
        seconds: Number(o.seconds),
        usage: { inputTokens: Number(o.input_tokens), outputTokens: Number(o.output_tokens) },
        actions: o.actions ? o.actions.split(' ') : [],
      };
      const row = toRow(q, o.run, r, grade(q, r), [0, 0]);
      row.cost_usd = o.cost_usd;
      return row;
    });
    const out = src.replace(/\.csv$/, '_rescored.csv');
    writeCsv(rows, out);
    const s = writeReport(rows, { model: path.basename(src, '.csv'), prices: [0, 0, 'from the original run'], runs: Math.max(...rows.map((r) => Number(r.run))), file: out, mode: 'rescored' });
    console.log(`Rescored ${s.total} runs: ${s.passed} passed (${pct(s.passed, s.total)}). Wrote ${path.relative(process.cwd(), out)} and .md`);
    return;
  }

  // Environment for the app, set before it's imported.
  process.env.PRELEGAL_DEMO_LIMITS = 'off';
  if (args.mock) process.env.PRELEGAL_AI_MODE = 'mock';
  else process.env.PRELEGAL_AI_MODE = '';
  if (args.model) process.env.OPENROUTER_MODEL = args.model;

  const { Client, startServer } = await import('../test/helpers.js');
  const config = await import('../server/config.js');
  if (!args.mock && config.AI_MODE !== 'openrouter') {
    console.error('OPENROUTER_API_KEY is not set (in the environment or .env). Use --mock to check the runner without a key.');
    process.exit(2);
  }
  const model = args.mock ? 'scripted' : config.MODEL;
  const prices = args.mock ? [0, 0, 'none (scripted)'] : await modelPrices(model, args);

  let qs = QUESTIONS;
  if (args.group) qs = qs.filter((q) => q.group === args.group);
  if (args.only.length) qs = qs.filter((q) => args.only.includes(q.id));
  if (args.limit) qs = qs.slice(0, args.limit);
  if (!qs.length) throw new Error('No questions match those options.');

  const slug = (s) => s.replace(/[^a-zA-Z0-9.-]+/g, '-');
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(RESULTS_DIR, `${date}_${slug(model)}${args.label ? `_${slug(args.label)}` : ''}.csv`);

  console.log(`Evaluating ${model}: ${qs.length} questions × ${args.runs} run(s). Prices: ${prices[2]}.`);
  const srv = await startServer();
  const rows = [];
  try {
    for (const q of qs) {
      for (let run = 1; run <= args.runs; run++) {
        let r;
        try {
          r = await askOne(Client, srv.base, q);
        } catch (err) {
          r = { reply: `[run error] ${scrub(err.message)}`, values: {}, seconds: 0, usage: { inputTokens: 0, outputTokens: 0 }, actions: [] };
        }
        const g = grade(q, r);
        rows.push(toRow(q, run, r, g, prices));
        process.stdout.write(`${g.pass ? '.' : 'F'}`);
      }
    }
  } finally {
    await srv.close();
  }
  process.stdout.write('\n');

  writeCsv(rows, file);
  const s = writeReport(rows, { model, prices, runs: args.runs, file, mode: args.mock ? 'scripted stand-in (runner check, not a model score)' : 'live model' });
  console.log(`${s.passed} of ${s.total} runs passed (${pct(s.passed, s.total)}); ${s.consistent} of ${s.questions} questions passed every run. Estimated cost $${s.cost.toFixed(4)}.`);
  console.log(`Wrote ${path.relative(process.cwd(), file)} and ${path.relative(process.cwd(), file.replace(/\.csv$/, '.md'))}`);
}

main().catch((err) => {
  console.error(scrub(err.stack || err.message));
  process.exit(1);
});
