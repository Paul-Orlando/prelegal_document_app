import HTMLtoDOCX from 'html-to-docx';
import MarkdownIt from 'markdown-it';
import PDFDocument from 'pdfkit';
import { getSpec } from './documentSpecs.js';
import { renderDocument } from './render.js';

const md = new MarkdownIt({ html: true });

/** The Standard Terms markdown embeds raw `<span class="...">` tags for
 * cross-referencing on commonpaper.com; strip them for a plain-text render. */
function stripHtmlTags(text) {
  return text.replace(/<\/?[a-zA-Z][^>]*>/g, '');
}

function bufferFromPdfDoc(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/** Render one line's `**bold**` spans as mixed-weight inline text. */
function renderInlineBold(doc, line) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '');
  if (parts.length === 0) {
    doc.text('');
    return;
  }
  parts.forEach((part, i) => {
    const isBold = /^\*\*[^*]+\*\*$/.test(part);
    const text = isBold ? part.slice(2, -2) : part;
    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(text, { continued: i < parts.length - 1 });
  });
  doc.font('Helvetica');
}

/**
 * A small, purpose-built markdown-to-PDF renderer — not a full CommonMark
 * implementation. It covers exactly what our rendered documents use: #/##/###
 * headings, `**bold**` spans, `---` rules, and `| a | b |` table rows. Good
 * enough for a readable legal-document PDF; not pixel-perfect typesetting.
 */
function renderMarkdownBody(doc, markdown) {
  const lines = stripHtmlTags(markdown).split('\n');
  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      doc.moveDown(0.4);
      continue;
    }
    if (line.trim() === '---') {
      doc.moveDown(0.3);
      continue;
    }

    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    if (h1) {
      doc.moveDown(0.6).fontSize(16).font('Helvetica-Bold').text(h1[1]);
      doc.fontSize(10.5).font('Helvetica');
      continue;
    }
    if (h2) {
      doc.moveDown(0.5).fontSize(13).font('Helvetica-Bold').text(h2[1]);
      doc.fontSize(10.5).font('Helvetica');
      continue;
    }
    if (h3) {
      doc.moveDown(0.4).fontSize(11.5).font('Helvetica-Bold').text(h3[1]);
      doc.fontSize(10.5).font('Helvetica');
      continue;
    }

    if (/^\|.*\|$/.test(line.trim())) {
      const cells = line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue; // separator row
      doc.fontSize(10).font('Helvetica-Bold').text(cells.join('    |    '));
      doc.font('Helvetica');
      continue;
    }

    doc.fontSize(10.5);
    renderInlineBold(doc, line);
  }
}

/** Render a document to a PDF Buffer. */
export async function renderPdfBuffer(specId, values) {
  const spec = getSpec(specId);
  if (!spec) throw new Error(`Unknown document type: ${specId}`);

  const markdown = renderDocument(specId, values);
  const doc = new PDFDocument({ size: 'LETTER', margin: 54, bufferPages: true });
  doc.font('Helvetica').fontSize(10.5);
  renderMarkdownBody(doc, markdown);
  return bufferFromPdfDoc(doc);
}

/** Render a document to a Word (.docx) Buffer. */
export async function renderDocxBuffer(specId, values) {
  const spec = getSpec(specId);
  if (!spec) throw new Error(`Unknown document type: ${specId}`);

  const markdown = renderDocument(specId, values);
  const html = md.render(markdown);
  return HTMLtoDOCX(html, null, { footer: false, pageNumber: false });
}
