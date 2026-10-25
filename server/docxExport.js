import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from 'docx';
import { ROOT_DIR } from './config.js';
import { buildDocModel, plainText } from './docModel.js';

/**
 * Word export. Mirrors the PDF layout: letterhead on page one, Key Terms
 * table, numbered Standard Terms with hanging indents, signature page, a
 * running header with the logo, and "Page X of Y" footers. Libre Caslon is
 * embedded so the document looks the same on machines that don't have it.
 */

const ASSETS = path.join(ROOT_DIR, 'server', 'assets');
const LOGO = fs.readFileSync(path.join(ASSETS, 'logo.png'));
const FONT = 'Libre Caslon Text';
const fontFile = (f) => fs.readFileSync(path.join(ASSETS, 'fonts', f));
const EMBED = [
  {
    name: FONT,
    data: fontFile('LibreCaslonText_400Regular.ttf'),
    bold: fontFile('LibreCaslonText_700Bold.ttf'),
    italic: fontFile('LibreCaslonText_400Regular_Italic.ttf'),
    characterSet: '00',
  },
];

const C = {
  ink: '1C2541',
  text: '23283A',
  muted: '5E6782',
  brass: 'B5862A',
  line: 'D5D9E3',
  shade: 'F3F4F8',
  draft: '8A6418',
  draftBg: 'FBF6EA',
};

const CONTENT_W = 9360; // twips: 8.5in page − 2 × 1in margins
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const hair = (color = C.line, size = 4) => ({ style: BorderStyle.SINGLE, size, color });

const pt = (n) => Math.round(n * 2); // docx sizes are half-points

function runsToText(runs, { size = 10, color = C.text } = {}) {
  return runs
    .filter((r) => r.text)
    .map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic, size: pt(size), color, font: FONT }));
}

const t = (text, opts = {}) => new TextRun({ text, font: FONT, color: C.text, size: pt(10), ...opts });

/* -------------------------------------------------------- header & footer */

function letterhead(model) {
  const a = model.firm.address;
  const right = { type: TabStopType.RIGHT, position: CONTENT_W };
  const small = (text) => t(text, { size: pt(8), color: C.muted });
  const line = (children, after = 0) =>
    new Paragraph({ tabStops: [right], spacing: { after, line: 240 }, indent: { left: 760 }, children });

  return new Header({
    children: [
      // The mark floats to the left of the wordmark; text lines are indented past it.
      new Paragraph({
        tabStops: [right],
        spacing: { after: 0, line: 240 },
        indent: { left: 760 },
        children: [
          new ImageRun({
            type: 'png',
            data: LOGO,
            transformation: { width: 44, height: 44 },
            floating: {
              horizontalPosition: { relative: 'margin', offset: 0 },
              verticalPosition: { relative: 'paragraph', offset: 0 },
              wrap: { type: 'none' },
              allowOverlap: true,
              behindDocument: false,
            },
          }),
          t('Prelegal', { bold: true, size: pt(19), color: C.ink }),
          small(`\t${model.firm.name}`),
        ],
      }),
      line([small(`Prepared with Prelegal by ${model.firm.name}`), small(`\t${a.line1}`)]),
      line([small(`\t${a.city}, ${a.region} ${a.postal}`)]),
      line([small(`\t${model.firm.phone.display}`)], 60),
      new Paragraph({ border: { bottom: hair(C.brass, 12) }, spacing: { after: 0 }, children: [] }),
    ],
  });
}

function runningHeader(model) {
  const children = [
    new ImageRun({ type: 'png', data: LOGO, transformation: { width: 20, height: 20 } }),
    t(`  ${model.title}`, { bold: true, size: pt(8.5), color: C.ink }),
  ];
  if (model.isDraft) {
    children.push(t('\tDraft — not for signature', { italics: true, size: pt(8.5), color: C.draft }));
  }
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        border: { bottom: hair() },
        spacing: { after: 0, line: 240 },
        children,
      }),
    ],
  });
}

function footer(model) {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        border: { top: hair() },
        spacing: { before: 80 },
        children: [
          t(`${model.shortName} — ${model.parties[0]} and ${model.parties[1]}`, { size: pt(7.5), color: C.muted }),
          new TextRun({
            font: FONT,
            size: pt(7.5),
            color: C.muted,
            children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
          }),
        ],
      }),
    ],
  });
}

/* ------------------------------------------------------------ building blocks */

const centered = (children, opts = {}) => new Paragraph({ alignment: AlignmentType.CENTER, children, ...opts });

function sectionHeading(text, { size = 13, center = false, pageBreak = false, before = 280 } = {}) {
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    keepNext: true,
    spacing: { before: pageBreak ? 0 : before, after: 140 },
    children: [
      ...(pageBreak ? [new PageBreak()] : []),
      t(text, { bold: true, size: pt(size), color: C.ink }),
    ],
  });
}

function brassRule() {
  // A short centred brass rule under page titles.
  return centered([t('───', { color: C.brass, size: pt(10) })], { spacing: { after: 240 } });
}

function draftNotice(model) {
  const text = `Draft — ${model.missingCount} required term${model.missingCount === 1 ? ' is' : 's are'} still to be completed. Not for signature.`;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    shading: { type: ShadingType.CLEAR, fill: C.draftBg, color: 'auto' },
    border: { top: hair(C.brass, 6), bottom: hair(C.brass, 6), left: hair(C.brass, 6), right: hair(C.brass, 6) },
    spacing: { before: 120, after: 280 },
    children: [t(text, { italics: true, size: pt(9), color: C.draft })],
  });
}

function keyTermsTable(rows) {
  const labelW = 3180;
  const valueW = CONTENT_W - labelW;
  const margins = { top: 90, bottom: 90, left: 120, right: 120 };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
    layout: TableLayoutType.FIXED,
    borders: { top: hair(), bottom: hair(), left: NONE, right: NONE, insideHorizontal: hair(), insideVertical: NONE },
    rows: rows.map(
      (row) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: labelW, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: C.shade, color: 'auto' },
              margins,
              children: [new Paragraph({ children: [t(row.label, { bold: true, size: pt(9), color: C.ink })] })],
            }),
            new TableCell({
              width: { size: valueW, type: WidthType.DXA },
              margins,
              children: [
                new Paragraph({
                  children: [
                    t(row.value ?? 'To be completed', {
                      italics: !row.value,
                      size: pt(9.5),
                      color: row.value && !row.none ? C.text : C.muted,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

const INDENT = {
  0: { left: 520, hanging: 520 },
  1: { left: 1160, hanging: 640 },
  2: { left: 1680, hanging: 520 },
  3: { left: 2200, hanging: 520 },
};

function termsBlocks(model) {
  const out = [];
  for (const block of model.terms) {
    if (block.type === 'heading') {
      out.push(sectionHeading(plainText(block.runs), { size: 12 }));
    } else if (block.type === 'note') {
      out.push(
        new Paragraph({
          spacing: { before: 240 },
          children: runsToText(block.runs.map((r) => ({ ...r, italic: true, bold: false })), { size: 8.5, color: C.muted }),
        }),
      );
    } else if (block.type === 'para') {
      out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runsToText(block.runs) }));
    } else {
      const ind = INDENT[Math.min(block.level, 3)];
      const labelRun = t(`${block.label}\t`, {
        bold: block.level === 0,
        color: block.level === 0 ? C.ink : C.muted,
        size: pt(block.isHeading ? 11 : 10),
      });
      out.push(
        new Paragraph({
          alignment: block.isHeading ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
          indent: ind,
          tabStops: [{ type: TabStopType.LEFT, position: ind.left }],
          keepNext: block.isHeading,
          spacing: { before: block.isHeading ? 200 : 0, after: block.level === 0 ? 140 : 100 },
          children: [
            labelRun,
            ...(block.isHeading
              ? [t(plainText(block.runs), { bold: true, size: pt(11), color: C.ink })]
              : runsToText(block.runs)),
          ],
        }),
      );
    }
  }
  return out;
}

function signatureTable(headings, labels) {
  const colW = CONTENT_W / 2;
  const cell = (heading, side) =>
    new TableCell({
      width: { size: colW, type: WidthType.DXA },
      borders: NO_BORDERS,
      margins: side === 0 ? { right: 300 } : { left: 300 },
      children: [
        new Paragraph({ keepNext: true, children: [t(heading, { bold: true, size: pt(10), color: C.ink })] }),
        ...labels.flatMap((label) => [
          new Paragraph({ border: { bottom: hair(C.ink, 6) }, spacing: { before: 160, after: 0 }, keepNext: true, children: [] }),
          new Paragraph({ spacing: { after: 0 }, keepNext: true, children: [t(label, { size: pt(7.5), color: C.muted })] }),
        ]),
      ],
    });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [colW, colW],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [new TableRow({ cantSplit: true, children: [cell(headings[0], 0), cell(headings[1], 1)] })],
  });
}

/* ------------------------------------------------------------------ main */

export async function renderDocxBuffer(specId, values) {
  const model = buildDocModel(specId, values);
  const [a, b] = model.parties;

  const cover = [
    centered([t(model.title, { bold: true, size: pt(24), color: C.ink })], { spacing: { before: 480, after: 60 } }),
    centered([t('Cover Page', { italics: true, size: pt(11), color: C.muted })], { spacing: { after: 200 } }),
    centered([t(`between ${a} and ${b}`, { size: pt(11) })], { spacing: { after: 40 } }),
    ...(model.effectiveDate
      ? [centered([t(`Effective ${model.effectiveDate}`, { color: C.muted })], { spacing: { after: 240 } })]
      : []),
    ...(model.isDraft ? [draftNotice(model)] : []),
    new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: runsToText(model.intro) }),
    sectionHeading('Key Terms'),
    keyTermsTable(model.keyTerms),
  ];

  const terms = [
    sectionHeading('Standard Terms', { size: 18, center: true, pageBreak: true }),
    centered(
      [t(`Common Paper ${model.title}, Version ${model.spec.version}. Incorporated by reference into the Cover Page.`, { italics: true, color: C.muted })],
      { spacing: { after: 60 } },
    ),
    brassRule(),
    ...termsBlocks(model),
  ];

  const signatures = [
    sectionHeading('Signatures', { size: 18, center: true, pageBreak: true }),
    brassRule(),
    centered([t(model.signatureIntro)], { spacing: { after: 240 } }),
    signatureTable([a, b], ['Signature', 'Print name', 'Title', 'Date']),
    sectionHeading('Witnesses', { size: 11, before: 160 }),
    signatureTable([`Witness for ${a}`, `Witness for ${b}`], ['Signature', 'Print name', 'Date']),
    sectionHeading('Approved as to Form', { size: 11, before: 160 }),
    new Paragraph({
      children: [t(`The undersigned attorneys reviewed this ${model.shortName} on behalf of their respective clients.`, { size: pt(9), color: C.muted })],
    }),
    signatureTable([`Attorney for ${a}`, `Attorney for ${b}`], ['Signature', 'Print name', 'Date']),
    new Paragraph({
      spacing: { before: 200 },
      children: [t(model.attribution, { italics: true, size: pt(7.5), color: C.muted })],
    }),
  ];

  const doc = new Document({
    creator: 'Prelegal',
    title: `${model.title} — ${a} and ${b}`,
    description: `Prepared with Prelegal by ${model.firm.name}`,
    fonts: EMBED,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: pt(10), color: C.text },
          paragraph: { spacing: { line: 300, after: 120 } },
        },
      },
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1500, bottom: 1300, left: 1440, right: 1440, header: 560, footer: 560 },
          },
        },
        headers: { first: letterhead(model), default: runningHeader(model) },
        footers: { first: footer(model), default: footer(model) },
        children: [...cover, ...terms, ...signatures],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
