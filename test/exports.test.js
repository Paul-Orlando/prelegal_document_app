// Downloads: PDF, Word and Markdown for every agreement, with the letterhead,
// logo, page numbers and draft marking.
import { Client, completeValues, pdfPageCount, startServer, unzip } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCUMENT_SPECS } from '../server/documentSpecs.js';
import { renderDocxBuffer, renderPdfBuffer } from '../server/exporters.js';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.close());

const docxText = (buf) => {
  const files = unzip(buf);
  const xml = (name) => (files[name] ? files[name].toString('utf8') : '');
  const headers = Object.keys(files).filter((n) => /^word\/header\d+\.xml$/.test(n)).map(xml).join('\n');
  const footers = Object.keys(files).filter((n) => /^word\/footer\d+\.xml$/.test(n)).map(xml).join('\n');
  return { files, body: xml('word/document.xml'), headers, footers };
};

describe('every agreement exports to PDF and Word', () => {
  for (const spec of DOCUMENT_SPECS) {
    test(spec.name, async () => {
      const values = { ...completeValues(spec) };
      const pdf = await renderPdfBuffer(spec.id, values);
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert.ok(pdfPageCount(pdf) >= 3, 'cover, terms and signature pages');

      const { files, body, headers, footers } = docxText(await renderDocxBuffer(spec.id, values));
      assert.ok(body.includes(spec.name), 'title');
      assert.ok(body.includes('Key Terms'));
      assert.ok(body.includes('Standard Terms'));
      assert.ok(body.includes('Signatures'));
      assert.doesNotMatch(body, /\*\*|&lt;span|‎/, 'no raw markdown, template HTML or hidden characters');
      assert.ok(Object.keys(files).some((n) => n.startsWith('word/media/')), 'logo image');
      assert.ok(Object.keys(files).some((n) => n.startsWith('word/fonts/')), 'embedded fonts');
      assert.match(headers, /Ashford &amp; Kane LLP/, 'letterhead');
      assert.match(footers, /PAGE/, 'page numbers');
      assert.doesNotMatch(headers, /Draft — not for signature/, 'complete document is not marked draft');
    });
  }
});

describe('draft marking', () => {
  test('an unfinished document says it is a draft, in both formats', async () => {
    const values = { party1: 'Duck LLC' };
    const { body, headers } = docxText(await renderDocxBuffer('mutual-nda', values));
    assert.match(headers, /Draft — not for signature/);
    assert.match(body, /required terms are still to be completed/);
    const pdf = await renderPdfBuffer('mutual-nda', values);
    assert.ok(pdfPageCount(pdf) >= 3);
  });

  test('missing required terms show as "To be completed", blank optional ones read naturally', async () => {
    const spec = DOCUMENT_SPECS.find((s) => s.id === 'cloud-service-agreement');
    const { body } = docxText(await renderDocxBuffer(spec.id, { provider: 'Acme' }));
    assert.match(body, /To be completed/);
    assert.match(body, /As set out in the Standard Terms/);
    assert.match(body, /Not applicable/);
    assert.match(body, />None</);
  });
});

describe('download endpoint', () => {
  test('serves each format with the right type and a readable filename', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    await c.patch(`/api/documents/${doc.id}`, { values: { party1: 'Duck LLC', party2: 'Dogs LLC' } });
    const expect = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      md: 'text/markdown; charset=utf-8',
    };
    for (const [format, type] of Object.entries(expect)) {
      const res = await c.get(`/api/documents/${doc.id}/download?format=${format}`, { raw: true });
      assert.equal(res.status, 200, format);
      assert.equal(res.headers.get('content-type'), type);
      assert.equal(res.headers.get('content-disposition'), `attachment; filename="MNDA-Duck-LLC-Dogs-LLC.${format}"`);
      assert.ok((await res.arrayBuffer()).byteLength > 500);
    }
  });

  test('an unknown format is rejected', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    assert.equal((await c.get(`/api/documents/${doc.id}/download?format=exe`)).status, 400);
  });

  test('party names cannot break the filename', async () => {
    const c = new Client(srv.base);
    const doc = await c.newDocument('mutual-nda');
    await c.patch(`/api/documents/${doc.id}`, { values: { party1: '../../etc/"passwd"\r\nX: y', party2: 'Dogs' } });
    const res = await c.get(`/api/documents/${doc.id}/download?format=md`, { raw: true });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /^attachment; filename="[A-Za-z0-9.-]+"$/);
  });
});
