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
      assert.doesNotMatch(body, /still to be completed/, 'complete document has no missing terms');
    });
  }
});

describe('sample marking (demo mode, the default)', () => {
  test('every page carries a SAMPLE watermark and a "not for use" header and footer', async () => {
    const { files, body, headers, footers } = docxText(await renderDocxBuffer('mutual-nda', { party1: 'Duck LLC' }));
    const media = Object.keys(files).filter((n) => n.startsWith('word/media/'));
    assert.ok(media.length >= 2, 'logo and watermark images');
    assert.match(headers, /behindDoc="1"/, 'watermark sits behind the text');
    assert.match(headers, /Sample — not for use/);
    assert.match(footers, /SAMPLE, NOT FOR USE/);
    assert.match(body, /Sample document for demonstration only\. Not for use, not legal advice, and not to be signed\./);
    assert.match(body, /must not be signed/, 'signature page');
  });

  test('the cover notice also says how many terms are missing', async () => {
    const { body } = docxText(await renderDocxBuffer('mutual-nda', { party1: 'Duck LLC' }));
    assert.match(body, /required terms are still to be completed/);
  });

  test('a finished document is still a sample, without the missing-terms note', async () => {
    const spec = DOCUMENT_SPECS.find((s) => s.id === 'mutual-nda');
    const { body, headers } = docxText(await renderDocxBuffer(spec.id, completeValues(spec)));
    assert.match(headers, /Sample — not for use/);
    assert.doesNotMatch(body, /still to be completed/);
  });

  test('PDF and Markdown are marked too', async () => {
    const { buildDocModel } = await import('../server/docModel.js');
    const { renderDocument, documentFilename } = await import('../server/render.js');
    const m = buildDocModel('mutual-nda', {});
    assert.equal(m.sample, true);
    assert.equal(m.headerTag, 'Sample — not for use');
    assert.match(m.footerPrefix, /SAMPLE, NOT FOR USE/);
    const md = renderDocument('mutual-nda', {});
    assert.ok(md.startsWith('> **SAMPLE, NOT FOR USE.**'));
    assert.ok(md.trimEnd().endsWith('not to be signed.'));
    assert.match(documentFilename(DOCUMENT_SPECS[0], {}, 'pdf'), /^SAMPLE-MNDA-/);
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

describe('live mode (PRELEGAL_DEMO_MODE=off)', () => {
  test('no sample marking; unfinished documents are marked as drafts instead', async () => {
    const { buildDocModel } = await import('../server/docModel.js');
    const { renderDocument, documentFilename } = await import('../server/render.js');
    const spec = DOCUMENT_SPECS[0];

    const draft = buildDocModel(spec.id, { party1: 'Duck LLC' }, { sample: false });
    assert.equal(draft.sample, false);
    assert.equal(draft.headerTag, 'Draft — not for signature');
    assert.match(draft.notice, /^Draft — .* Not for signature\.$/);
    assert.match(draft.signatureIntro, /By signing below/);

    const done = buildDocModel(spec.id, completeValues(spec), { sample: false });
    assert.equal(done.headerTag, null);
    assert.equal(done.notice, null);
    assert.equal(done.footerPrefix, '');

    assert.doesNotMatch(renderDocument(spec.id, {}, { sample: false }), /SAMPLE/);
    assert.match(documentFilename(spec, {}, 'pdf', { sample: false }), /^MNDA-/);
  });

  test('the setting is read from the environment and defaults to demo', async () => {
    const { execFileSync } = await import('node:child_process');
    const run = (value) =>
      execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e',
        "const { DEMO_MODE } = await import('./server/config.js'); console.log(DEMO_MODE);"], {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
        env: { ...process.env, PRELEGAL_DEMO_MODE: value },
      }).trim();
    assert.equal(run(''), 'true');
    assert.equal(run('on'), 'true');
    assert.equal(run('no'), 'true', 'only the word off switches demo mode off');
    assert.equal(run('off'), 'false');
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
      assert.equal(res.headers.get('content-disposition'), `attachment; filename="SAMPLE-MNDA-Duck-LLC-Dogs-LLC.${format}"`);
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
