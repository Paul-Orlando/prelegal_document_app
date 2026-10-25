import path from 'node:path';
import PDFDocument from 'pdfkit';
import { ROOT_DIR } from './config.js';
import { buildDocModel, plainText } from './docModel.js';

/**
 * Typeset an agreement as a PDF: letterhead cover page with a Key Terms table,
 * numbered Standard Terms with hanging indents, and a signature page with
 * drawn signature lines. Running header and "Page X of Y" footer on every page.
 */

const FONT_DIR = path.join(ROOT_DIR, 'server', 'assets', 'fonts');
const F = {
  regular: path.join(FONT_DIR, 'LibreCaslonText_400Regular.ttf'),
  bold: path.join(FONT_DIR, 'LibreCaslonText_700Bold.ttf'),
  italic: path.join(FONT_DIR, 'LibreCaslonText_400Regular_Italic.ttf'),
};

const C = {
  ink: '#1C2541',
  text: '#23283A',
  muted: '#5E6782',
  brass: '#B5862A',
  line: '#D5D9E3',
  shade: '#F3F4F8',
  draft: '#8A6418',
  draftBg: '#FBF6EA',
};

const PAGE = { width: 612, height: 792 };
const M = { top: 96, bottom: 76, left: 72, right: 72 };
const CONTENT_W = PAGE.width - M.left - M.right;
const BODY = 10;

/* ----------------------------------------------------------------- logo */

/** Draw the scale-and-pen mark with its top-left at (x, y), `size` points square. */
export function drawLogo(doc, x, y, size) {
  doc.save();
  doc.translate(x, y).scale(size / 64);
  doc.lineWidth(2.6).lineCap('round').lineJoin('round').strokeColor(C.brass);
  doc.path('M9 17 H55').stroke();
  doc.path('M12 17 L6 33 M12 17 L18 33').stroke();
  doc.path('M52 17 L46 33 M52 17 L58 33').stroke();
  doc.fillColor(C.brass);
  doc.path('M4 33 H20 A8 8 0 0 1 4 33 Z').fill();
  doc.path('M44 33 H60 A8 8 0 0 1 44 33 Z').fill();
  doc.circle(32, 9.5, 3).fill();
  doc.fillColor(C.ink);
  doc.roundedRect(28.2, 13, 7.6, 25, 2.2).fill();
  doc.path('M28.2 39.5 H35.8 L32 55 Z').fill();
  doc.roundedRect(23, 57, 18, 3, 1.5).fill();
  doc.fillColor(C.brass).rect(28.2, 22, 7.6, 2).fill();
  doc.strokeColor('#FFFFFF').lineWidth(1.1).path('M32 44.5 V51.5').stroke();
  doc.fillColor('#FFFFFF').circle(32, 43.6, 1.3).fill();
  doc.restore();
}

/* -------------------------------------------------------------- helpers */

const fontFor = (r) => (r.bold ? 'bold' : r.italic ? 'italic' : 'regular');

/**
 * Break runs into "words" (sequences of styled segments between spaces), so a
 * bold term inside quotes — (“**MNDA**”) — stays one unbreakable word.
 */
function toWords(doc, runs, size) {
  const words = [];
  let cur = [];
  for (const r of runs) {
    for (const part of r.text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        if (cur.length) words.push(cur);
        cur = [];
      } else {
        cur.push({ text: part, font: fontFor(r) });
      }
    }
  }
  if (cur.length) words.push(cur);

  // Web addresses may break after a slash; the pieces join with no space.
  const out = [];
  for (const segs of words) {
    const isUrl = segs.length === 1 && segs[0].text.length > 24 && segs[0].text.includes('/');
    const pieces = isUrl ? segs[0].text.split(/(?<=\/)/).map((t) => [{ text: t, font: segs[0].font }]) : [segs];
    pieces.forEach((p, i) => out.push({ segs: p, glue: i > 0 }));
  }
  return out.map((w) => ({
    ...w,
    width: w.segs.reduce((acc, s) => acc + doc.font(s.font).fontSize(size).widthOfString(s.text), 0),
  }));
}

function breakLines(words, width, spaceW) {
  const lines = [];
  let line = [];
  let lineW = 0;
  for (const w of words) {
    const add = line.length && !w.glue ? spaceW + w.width : w.width;
    if (line.length && lineW + add > width) {
      lines.push({ words: line, width: lineW });
      w.glue = false;
      line = [w];
      lineW = w.width;
    } else {
      line.push(w);
      lineW += add;
    }
  }
  if (line.length) lines.push({ words: line, width: lineW });
  return lines;
}

const lineHeight = (size) => size * 1.5;

/**
 * Typeset runs as a paragraph at (x, y): our own line breaking and
 * justification, page breaks between lines. Returns the y below the paragraph.
 */
function writeRuns(doc, runs, x, y, width, { size = BODY, align = 'justify', color = C.text } = {}) {
  const words = toWords(doc, runs.filter((r) => r.text), size);
  if (!words.length) return y;
  const spaceW = doc.font('regular').fontSize(size).widthOfString(' ');
  const lines = breakLines(words, width, spaceW);
  const lh = lineHeight(size);
  let cy = y;

  lines.forEach((line, li) => {
    if (cy + lh > PAGE.height - M.bottom) {
      doc.addPage();
      cy = M.top;
    }
    const last = li === lines.length - 1;
    let gap = spaceW;
    let cx = x;
    const gaps = line.words.filter((w, i) => i > 0 && !w.glue).length;
    if (align === 'justify' && !last && gaps > 0) {
      gap = spaceW + (width - line.width) / gaps;
    } else if (align === 'center') {
      cx = x + (width - line.width) / 2;
    }
    line.words.forEach((w, wi) => {
      if (wi > 0 && !w.glue) cx += gap;
      for (const seg of w.segs) {
        doc.font(seg.font).fontSize(size).fillColor(color).text(seg.text, cx, cy, { lineBreak: false });
        cx += doc.widthOfString(seg.text);
      }
    });
    cy += lh;
  });
  doc.y = cy;
  return cy;
}

/** Height that `runs` would take as a paragraph. */
function runsHeight(doc, runs, width, size = BODY) {
  const words = toWords(doc, runs, size);
  const spaceW = doc.font('regular').fontSize(size).widthOfString(' ');
  return breakLines(words, width, spaceW).length * lineHeight(size);
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > PAGE.height - M.bottom) {
    doc.addPage();
    doc.y = M.top;
  }
}

function sectionHeading(doc, text, { center = false, size = 13 } = {}) {
  ensureSpace(doc, 60);
  doc.font('bold').fontSize(size).fillColor(C.ink);
  doc.text(text, M.left, doc.y, { width: CONTENT_W, align: center ? 'center' : 'left' });
  const y = doc.y + 4;
  const x = center ? PAGE.width / 2 - 18 : M.left;
  doc.moveTo(x, y).lineTo(x + 36, y).lineWidth(1.2).strokeColor(C.brass).stroke();
  doc.y = y + 12;
}

/* ------------------------------------------------------------ cover page */

function letterhead(doc, model) {
  const top = 44;
  drawLogo(doc, M.left, top, 40);
  doc.font('bold').fontSize(19).fillColor(C.ink).text('Prelegal', M.left + 48, top + 6, { lineBreak: false });
  doc.font('regular').fontSize(8).fillColor(C.muted)
    .text(`Prepared with Prelegal by ${model.firm.name}`, M.left + 48, top + 28, { lineBreak: false });

  const a = model.firm.address;
  const right = [model.firm.name, a.line1, `${a.city}, ${a.region} ${a.postal}`, model.firm.phone.display];
  doc.font('regular').fontSize(8).fillColor(C.muted);
  right.forEach((line, i) => {
    doc.text(line, M.left, top + 2 + i * 10.5, { width: CONTENT_W, align: 'right', lineBreak: false });
  });

  const y = top + 50;
  doc.moveTo(M.left, y).lineTo(PAGE.width - M.right, y).lineWidth(1.25).strokeColor(C.brass).stroke();
}

function coverNotice(doc, model) {
  const text = model.notice;
  doc.font(model.sample ? 'bold' : 'italic').fontSize(9);
  const h = doc.heightOfString(text, { width: CONTENT_W - 24 }) + 14;
  const y = doc.y;
  doc.rect(M.left, y, CONTENT_W, h).fillAndStroke(C.draftBg, C.brass);
  doc.fillColor(C.draft).text(text, M.left + 12, y + 7, { width: CONTENT_W - 24, align: 'center' });
  doc.y = y + h + 14;
}

function coverPage(doc, model) {
  letterhead(doc, model);

  doc.y = 140;
  doc.font('bold').fontSize(24).fillColor(C.ink)
    .text(model.title, M.left, doc.y, { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.35);
  doc.font('italic').fontSize(11).fillColor(C.muted)
    .text('Cover Page', { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.9);

  doc.font('regular').fontSize(11).fillColor(C.text)
    .text(`between ${model.parties[0]} and ${model.parties[1]}`, { width: CONTENT_W, align: 'center' });
  if (model.effectiveDate) {
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor(C.muted).text(`Effective ${model.effectiveDate}`, { width: CONTENT_W, align: 'center' });
  }
  doc.moveDown(1.1);

  if (model.notice) coverNotice(doc, model);

  writeRuns(doc, model.intro, M.left, doc.y, CONTENT_W);
  doc.y += 16;

  sectionHeading(doc, 'Key Terms');
  keyTermsTable(doc, model.keyTerms);
}

function keyTermsTable(doc, rows) {
  const labelW = Math.round(CONTENT_W * 0.34);
  const valueW = CONTENT_W - labelW;
  const pad = 5.5;

  doc.lineWidth(0.6).strokeColor(C.line);
  let first = true;
  for (const row of rows) {
    const value = row.value ?? 'To be completed';
    doc.font('bold').fontSize(9);
    const hL = doc.heightOfString(row.label, { width: labelW - pad * 2 });
    doc.font(row.value ? 'regular' : 'italic').fontSize(9.5);
    const hV = doc.heightOfString(value, { width: valueW - pad * 2, lineGap: 2 });
    const h = Math.max(hL, hV) + pad * 2;

    if (doc.y + h > PAGE.height - M.bottom) {
      doc.addPage();
      doc.y = M.top;
      doc.font('italic').fontSize(9).fillColor(C.muted).text('Key Terms, continued', M.left, doc.y, { width: CONTENT_W });
      doc.y += 6;
      first = true;
    }
    const y = doc.y;
    doc.rect(M.left, y, labelW, h).fill(C.shade);
    if (first) doc.moveTo(M.left, y).lineTo(M.left + CONTENT_W, y).strokeColor(C.line).stroke();
    doc.moveTo(M.left, y + h).lineTo(M.left + CONTENT_W, y + h).strokeColor(C.line).stroke();

    doc.font('bold').fontSize(9).fillColor(C.ink).text(row.label, M.left + pad, y + pad, { width: labelW - pad * 2 });
    doc.font(row.value ? 'regular' : 'italic').fontSize(9.5).fillColor(row.value && !row.none ? C.text : C.muted)
      .text(value, M.left + labelW + pad, y + pad, { width: valueW - pad * 2, lineGap: 2 });
    doc.y = y + h;
    first = false;
  }
}

/* --------------------------------------------------------- standard terms */

const INDENT = {
  0: { left: 0, label: 26 },
  1: { left: 26, label: 32 },
  2: { left: 58, label: 26 },
  3: { left: 84, label: 26 },
};

function standardTerms(doc, model) {
  doc.addPage();
  doc.y = M.top + 8;
  doc.font('bold').fontSize(18).fillColor(C.ink)
    .text('Standard Terms', M.left, doc.y, { width: CONTENT_W, align: 'center' });
  doc.moveDown(0.3);
  doc.font('italic').fontSize(10).fillColor(C.muted)
    .text(`Common Paper ${model.title}, Version ${model.spec.version}. Incorporated by reference into the Cover Page.`, {
      width: CONTENT_W,
      align: 'center',
    });
  const y = doc.y + 10;
  doc.moveTo(PAGE.width / 2 - 18, y).lineTo(PAGE.width / 2 + 18, y).lineWidth(1.2).strokeColor(C.brass).stroke();
  doc.y = y + 22;

  for (const block of model.terms) {
    if (block.type === 'heading') {
      doc.y += 6;
      sectionHeading(doc, plainText(block.runs), { size: 12 });
      continue;
    }
    if (block.type === 'note') {
      doc.y += 10;
      ensureSpace(doc, 30);
      writeRuns(doc, block.runs.map((r) => ({ ...r, italic: true, bold: false })), M.left, doc.y, CONTENT_W, {
        size: 8.5,
        color: C.muted,
        align: 'left',
      });
      continue;
    }
    if (block.type === 'para') {
      ensureSpace(doc, 30);
      writeRuns(doc, block.runs, M.left, doc.y, CONTENT_W);
      doc.y += 8;
      continue;
    }

    const ind = INDENT[Math.min(block.level, 3)];
    const x = M.left + ind.left;
    const textX = x + ind.label;
    const width = CONTENT_W - ind.left - ind.label;

    if (block.isHeading) {
      doc.y += 8;
      ensureSpace(doc, 70); // keep the heading with its first sub-clause
      const top = doc.y;
      doc.font('bold').fontSize(11).fillColor(C.ink).text(block.label, x, top, { width: ind.label, lineBreak: false });
      doc.text(plainText(block.runs), textX, top, { width });
      doc.y += 6;
      continue;
    }

    const h = runsHeight(doc, block.runs, width);
    ensureSpace(doc, Math.min(h, 3 * lineHeight(BODY)));
    const top = doc.y;
    doc.font(block.level === 0 ? 'bold' : 'regular').fontSize(BODY).fillColor(block.level === 0 ? C.ink : C.muted)
      .text(block.label, x, top, { width: ind.label, lineBreak: false });
    writeRuns(doc, block.runs, textX, top, width);
    doc.y += block.level === 0 ? 7 : 4;
  }
}

/* ---------------------------------------------------------- signature page */

function signatureColumns(doc, headings, labels) {
  const gap = 36;
  const colW = (CONTENT_W - gap) / 2;
  const rowH = 25;
  const needed = 22 + labels.length * rowH;
  ensureSpace(doc, needed);
  const top = doc.y;

  headings.forEach((heading, col) => {
    const x = M.left + col * (colW + gap);
    doc.font('bold').fontSize(10).fillColor(C.ink).text(heading, x, top, { width: colW, height: 26, ellipsis: true });
    labels.forEach((label, i) => {
      const lineY = top + 18 + i * rowH + 14;
      doc.moveTo(x, lineY).lineTo(x + colW, lineY).lineWidth(0.7).strokeColor(C.ink).stroke();
      doc.font('regular').fontSize(7.5).fillColor(C.muted).text(label, x, lineY + 3, { width: colW, lineBreak: false });
    });
  });
  doc.y = top + needed + 10;
}

function signaturePage(doc, model) {
  doc.addPage();
  doc.y = M.top + 8;
  doc.font('bold').fontSize(18).fillColor(C.ink).text('Signatures', M.left, doc.y, { width: CONTENT_W, align: 'center' });
  const y = doc.y + 8;
  doc.moveTo(PAGE.width / 2 - 18, y).lineTo(PAGE.width / 2 + 18, y).lineWidth(1.2).strokeColor(C.brass).stroke();
  doc.y = y + 18;

  doc.font('regular').fontSize(BODY).fillColor(C.text)
    .text(model.signatureIntro, M.left, doc.y, { width: CONTENT_W, align: 'center' });
  doc.y += 22;

  const [a, b] = model.parties;
  signatureColumns(doc, [a, b], ['Signature', 'Print name', 'Title', 'Date']);

  sectionHeading(doc, 'Witnesses', { size: 11 });
  signatureColumns(doc, [`Witness for ${a}`, `Witness for ${b}`], ['Signature', 'Print name', 'Date']);

  sectionHeading(doc, 'Approved as to Form', { size: 11 });
  doc.font('regular').fontSize(9).fillColor(C.muted)
    .text(`The undersigned attorneys reviewed this ${model.shortName} on behalf of their respective clients.`, M.left, doc.y, { width: CONTENT_W });
  doc.y += 10;
  signatureColumns(doc, [`Attorney for ${a}`, `Attorney for ${b}`], ['Signature', 'Print name', 'Date']);

  doc.y += 6;
  ensureSpace(doc, 34);
  doc.font('italic').fontSize(7.5).fillColor(C.muted).text(model.attribution, M.left, doc.y, { width: CONTENT_W, lineGap: 1.5 });
}

/* ------------------------------------------------- running header & footer */

function runningElements(doc, model) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  const partyLine = `${model.parties[0]} and ${model.parties[1]}`;

  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    if (i > 0) {
      drawLogo(doc, M.left, 38, 20);
      doc.font('bold').fontSize(8.5).fillColor(C.ink).text(model.title, M.left + 26, 45, { lineBreak: false });
      if (model.headerTag) {
        doc.font(model.sample ? 'bold' : 'italic').fontSize(8.5).fillColor(C.draft)
          .text(model.headerTag, M.left, 45, { width: CONTENT_W, align: 'right', lineBreak: false });
      }
      doc.moveTo(M.left, 64).lineTo(PAGE.width - M.right, 64).lineWidth(0.5).strokeColor(C.line).stroke();
    }

    const fy = PAGE.height - 50;
    doc.moveTo(M.left, fy - 8).lineTo(PAGE.width - M.right, fy - 8).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('regular').fontSize(7.5).fillColor(C.muted)
      .text(`${model.footerPrefix}${model.shortName} — ${partyLine}`, M.left, fy, { width: CONTENT_W * 0.7, lineBreak: false, ellipsis: true });
    doc.text(`Page ${i + 1} of ${total}`, M.left, fy, { width: CONTENT_W, align: 'right', lineBreak: false });

    if (model.sample) watermark(doc);

    doc.page.margins.bottom = savedBottom;
  }
}

/** A large, light, diagonal SAMPLE across the middle of the page. */
function watermark(doc) {
  doc.save();
  doc.rotate(-40, { origin: [PAGE.width / 2, PAGE.height / 2] });
  doc.fillColor(C.brass).fillOpacity(0.13);
  doc.font('bold').fontSize(120)
    .text('SAMPLE', -100, PAGE.height / 2 - 70, { width: PAGE.width + 200, align: 'center', lineBreak: false });
  doc.restore();
}

/* ------------------------------------------------------------------ main */

export async function renderPdfBuffer(specId, values) {
  const model = buildDocModel(specId, values);
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: M,
    bufferPages: true,
    info: {
      Title: `${model.title} — ${model.parties[0]} and ${model.parties[1]}`,
      Author: 'Prelegal',
      Creator: `Prelegal by ${model.firm.name}`,
      Subject: model.title,
    },
  });
  doc.registerFont('regular', F.regular);
  doc.registerFont('bold', F.bold);
  doc.registerFont('italic', F.italic);

  coverPage(doc, model);
  standardTerms(doc, model);
  signaturePage(doc, model);
  runningElements(doc, model);

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
