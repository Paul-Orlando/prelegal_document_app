/**
 * Shared test setup. Import this before anything from server/.
 *
 * Every test file runs in its own process (node --test), with its own
 * throwaway database and the scripted interviewer, so no API key is needed and
 * nothing touches .data/prelegal.db.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prelegal-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.PRELEGAL_AI_MODE ??= 'mock';
process.env.PRELEGAL_DEMO_LIMITS ??= 'on';

process.on('exit', () => {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

/** Start the app on a random port. Returns { base, close }. */
export async function startServer() {
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

/**
 * A browser stand-in: keeps the session cookie between requests, like one
 * visitor's browser. Two Clients are two different visitors.
 */
export class Client {
  constructor(base, { ip } = {}) {
    this.base = base;
    this.cookie = null;
    this.ip = ip;
  }

  async request(method, url, body, { raw = false, headers = {} } = {}) {
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (this.ip) h['x-forwarded-for'] = this.ip;
    let payload;
    if (body !== undefined) {
      h['content-type'] = 'application/json';
      payload = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(this.base + url, { method, headers: h, body: payload });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    if (raw) return res;
    const type = res.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  }

  get(url, opts) { return this.request('GET', url, undefined, opts); }
  post(url, body, opts) { return this.request('POST', url, body ?? {}, opts); }
  patch(url, body, opts) { return this.request('PATCH', url, body, opts); }
  delete(url, opts) { return this.request('DELETE', url, undefined, opts); }

  /** Create a document of a type and return it. */
  async newDocument(specId) {
    const res = await this.post('/api/documents', { specId });
    if (res.status !== 201) throw new Error(`newDocument ${specId}: ${res.status} ${JSON.stringify(res.data)}`);
    return res.data.document;
  }
}

/** Values for every required field of a spec, so a document is complete. */
export function completeValues(spec) {
  const values = {};
  for (const f of spec.fields) {
    if (!f.required) continue;
    values[f.key] = f.type === 'date' ? '2026-11-01' : f.default || `Sample ${f.label.toLowerCase()}`;
  }
  return values;
}

/**
 * Read the files inside a .docx (a zip) without a zip library: walk the
 * central directory and inflate each entry. Returns { name: Buffer }.
 */
export function unzip(buffer) {
  const files = {};
  let eocd = buffer.length - 22;
  while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(p + 10);
    const compSize = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buffer.readUInt16LE(local + 26);
    const lExtraLen = buffer.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buffer.subarray(start, start + compSize);
    files[name] = method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/** Number of pages in a PDF produced by pdfkit. */
export function pdfPageCount(buffer) {
  return (buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
}
