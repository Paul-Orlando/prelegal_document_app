import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATES_DIR } from './config.js';
import { getSpec } from './documentSpecs.js';

const templateCache = new Map();

/** Read a Standard Terms markdown file out of templates/, with caching. */
export function readStandardTerms(filename) {
  if (templateCache.has(filename)) return templateCache.get(filename);

  // Guard against path traversal: the filename comes from our own specs, but
  // this keeps that guarantee local rather than implicit.
  const resolved = path.resolve(TEMPLATES_DIR, filename);
  if (path.dirname(resolved) !== path.resolve(TEMPLATES_DIR)) {
    throw new Error(`Refusing to read template outside templates/: ${filename}`);
  }
  const text = fs.readFileSync(resolved, 'utf8');
  templateCache.set(filename, text);
  return text;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function displayValue(field, values) {
  const raw = values[field.key];
  const value = raw === undefined || raw === null || String(raw).trim() === '' ? '' : String(raw).trim();
  if (!value) {
    return field.default ? String(field.default) : '_[To be completed]_';
  }
  return field.type === 'date' ? formatDate(value) : value;
}

/** Escape pipes so a value can't break out of a markdown table cell. */
function cell(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

const SIGNATURE_LINE = '_'.repeat(40);

/** A labeled blank line for someone to fill in by hand, e.g. "Signature: ____". */
function signatureLine(lines, label) {
  lines.push(`${label}: ${SIGNATURE_LINE}`);
  lines.push('');
}

/** A named individual's block of signature lines (signature, name, date, etc.). */
function signatureBlock(lines, heading, fieldLabels) {
  lines.push(`**${heading}**`);
  lines.push('');
  for (const label of fieldLabels) signatureLine(lines, label);
}

/**
 * The two signing parties for a document type. Different agreements name their
 * parties differently (Provider/Customer, Company/Partner, Party 1/Party 2).
 */
function partyLabels(spec, values) {
  const pick = (key, fallback) => {
    const v = values[key];
    return v && String(v).trim() ? String(v).trim() : fallback;
  };
  switch (spec.id) {
    case 'mutual-nda':
      return [pick('party1', 'Party 1'), pick('party2', 'Party 2')];
    case 'partnership-agreement':
      return [pick('company', 'Company'), pick('partner', 'Partner')];
    case 'business-associate-agreement':
      return [pick('company', 'Covered Entity'), pick('provider', 'Business Associate')];
    case 'design-partner-agreement':
      return [pick('provider', 'Provider'), pick('partner', 'Partner')];
    default:
      return [pick('provider', 'Provider'), pick('customer', 'Customer')];
  }
}

/**
 * Build the cover page for a document.
 *
 * Common Paper only publishes a fillable Cover Page for the Mutual NDA; for
 * every other agreement the markdown in templates/ is Standard Terms only. So
 * this generates a Prelegal-authored cover page that captures the variables the
 * Standard Terms reference and incorporates those terms by reference.
 */
export function renderCoverPage(spec, values = {}) {
  const [partyA, partyB] = partyLabels(spec, values);
  const lines = [];

  lines.push(`# ${spec.name}`);
  lines.push('');
  lines.push(
    `This ${spec.shortName} consists of (1) this Cover Page and (2) the Common Paper ` +
      `${spec.name} Standard Terms Version ${spec.version}, identical to those posted at ` +
      `[${spec.standardTermsUrl}](${spec.standardTermsUrl}) and reproduced below. ` +
      `Any modifications to the Standard Terms should be made on this Cover Page, which controls ` +
      `over any conflict with the Standard Terms.`,
  );
  lines.push('');
  lines.push('## Key Terms');
  lines.push('');
  lines.push('| Term | Value |');
  lines.push('| :--- | :--- |');
  for (const field of spec.fields) {
    lines.push(`| **${cell(field.label)}** | ${cell(displayValue(field, values))} |`);
  }

  return lines.join('\n');
}

/**
 * Build the signature (execution) page for a document. This comes at the end
 * of the agreement, after the Standard Terms, rather than on the cover page.
 */
export function renderSignaturePage(spec, values = {}) {
  const [partyA, partyB] = partyLabels(spec, values);
  const lines = [];

  lines.push('## Signatures');
  lines.push('');
  lines.push(
    `By signing below, each party agrees to enter into this ${spec.shortName} as of the date written above.`,
  );
  lines.push('');
  const sigFields = ['Signature', 'Initials', 'Print Name', 'Title', 'Date'];
  signatureBlock(lines, cell(partyA), sigFields);
  signatureBlock(lines, cell(partyB), sigFields);

  lines.push('### Witnesses');
  lines.push('');
  const witnessFields = ['Signature', 'Print Name', 'Date'];
  signatureBlock(lines, `Witness for ${cell(partyA)}`, witnessFields);
  signatureBlock(lines, `Witness for ${cell(partyB)}`, witnessFields);

  lines.push('### Approved as to Form');
  lines.push('');
  lines.push(
    `The undersigned attorneys reviewed this ${spec.shortName} on behalf of their respective clients.`,
  );
  lines.push('');
  signatureBlock(lines, `Attorney for ${cell(partyA)}`, witnessFields);
  signatureBlock(lines, `Attorney for ${cell(partyB)}`, witnessFields);
  lines.push(
    `Based on the Common Paper ${spec.name} (Version ${spec.version}) by Common Paper, ` +
      `used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified from the original.`,
  );

  return lines.join('\n');
}

/** Cover page + the upstream Standard Terms + a signature page, as one markdown document. */
export function renderDocument(specId, values = {}) {
  const spec = getSpec(specId);
  if (!spec) throw new Error(`Unknown document type: ${specId}`);

  const coverPage = renderCoverPage(spec, values);
  const standardTerms = readStandardTerms(spec.standardTerms);
  const signaturePage = renderSignaturePage(spec, values);

  return [
    coverPage,
    '',
    '---',
    '',
    `# ${spec.name} — Standard Terms (Version ${spec.version})`,
    '',
    `_The following Standard Terms are incorporated into the Cover Page above._`,
    '',
    standardTerms,
    '',
    '---',
    '',
    signaturePage,
  ].join('\n');
}

/** Suggested download filename for a rendered document. */
export function documentFilename(spec, values = {}, extension = 'md') {
  const [partyA, partyB] = partyLabels(spec, values);
  const slug = (s) =>
    String(s)
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'party';
  return `${slug(spec.shortName)}-${slug(partyA)}-${slug(partyB)}.${extension}`;
}
