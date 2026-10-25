import MarkdownIt from 'markdown-it';
import { getSpec, missingRequiredFields } from './documentSpecs.js';
import { formatDate, partyLabels, readStandardTerms } from './render.js';
import { FIRM } from './firm.js';
import { DEMO_MODE } from './config.js';

/**
 * A format-neutral model of a finished agreement, shared by the PDF and Word
 * exporters so both produce the same structure: letterhead cover page with a
 * Key Terms table, numbered Standard Terms, and a signature page.
 *
 * Text is held as "runs": [{ text, bold?, italic? }].
 */

const md = new MarkdownIt({ html: true });

/* ------------------------------------------------------- inline → runs */

/** Convert a markdown-it inline token's children into runs, with "\n" runs for line breaks. */
function inlineToRuns(children = []) {
  const runs = [];
  let bold = 0;
  let italic = 0;
  const spanStack = [];

  for (const t of children) {
    switch (t.type) {
      case 'text':
      case 'code_inline': {
        // Drop invisible direction marks / zero-width characters some templates contain.
        const text = t.content.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
        if (text) runs.push({ text, bold: bold > 0, italic: italic > 0 });
        break;
      }
      case 'strong_open': bold++; break;
      case 'strong_close': bold--; break;
      case 'em_open': italic++; break;
      case 'em_close': italic--; break;
      case 'softbreak':
      case 'hardbreak':
        runs.push({ text: '\n' });
        break;
      case 'html_inline': {
        // Common Paper marks clause titles with <span class="header_2|header_3">.
        if (/^<span\b/i.test(t.content)) {
          const isHeader = /class="header_[23]"/.test(t.content);
          spanStack.push(isHeader);
          if (isHeader) bold++;
        } else if (/^<\/span>/i.test(t.content)) {
          if (spanStack.pop()) bold--;
        }
        break;
      }
      default:
        // link_open/close and anything else: keep the text, drop the markup.
        break;
    }
  }
  return mergeRuns(runs);
}

/** Merge adjacent runs with identical styling and collapse runs of spaces. */
function mergeRuns(runs) {
  const out = [];
  for (const r of runs) {
    const text = r.text === '\n' ? '\n' : r.text.replace(/[ \t]{2,}/g, ' ');
    const prev = out[out.length - 1];
    if (prev && text !== '\n' && prev.text !== '\n' && !!prev.bold === !!r.bold && !!prev.italic === !!r.italic) {
      prev.text += text;
    } else {
      out.push({ text, bold: !!r.bold, italic: !!r.italic });
    }
  }
  return out;
}

/** Split runs at "\n" markers into lines of runs. */
function splitLines(runs) {
  const lines = [[]];
  for (const r of runs) {
    if (r.text === '\n') lines.push([]);
    else lines[lines.length - 1].push(r);
  }
  return lines.filter((l) => l.some((r) => r.text.trim()));
}

const trimRuns = (runs) => {
  const copy = runs.map((r) => ({ ...r }));
  if (copy.length) copy[0].text = copy[0].text.replace(/^\s+/, '');
  if (copy.length) copy[copy.length - 1].text = copy[copy.length - 1].text.replace(/\s+$/, '');
  return copy.filter((r) => r.text);
};

export const plainText = (runs) => runs.map((r) => r.text).join('');

/* -------------------------------------------------- standard terms → blocks */

/**
 * Parse Standard Terms markdown into blocks:
 *  { type: 'clause', level, label, runs, isHeading }   numbered clause
 *  { type: 'heading', runs }                          sub-heading inside the terms
 *  { type: 'para', runs }                             unnumbered paragraph
 *  { type: 'note', runs }                             trailing licence line
 */
export function parseTerms(markdown) {
  const tokens = md.parse(markdown, {});
  const blocks = [];
  const counters = [];
  let headingLevel = 0;
  let firstH1Skipped = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'ordered_list_open' || t.type === 'bullet_list_open') {
      const start = Number(t.attrGet('start') || 1);
      counters.push({ n: start - 1, bullet: t.type === 'bullet_list_open' });
    } else if (t.type === 'ordered_list_close' || t.type === 'bullet_list_close') {
      counters.pop();
    } else if (t.type === 'list_item_open') {
      counters[counters.length - 1].n++;
      counters[counters.length - 1].paras = 0;
    } else if (t.type === 'heading_open') {
      headingLevel = Number(t.tag.slice(1));
    } else if (t.type === 'inline') {
      const runs = inlineToRuns(t.children);
      if (headingLevel) {
        // The template's own top title ("# Standard Terms") is replaced by ours.
        if (headingLevel === 1 && !firstH1Skipped) firstH1Skipped = true;
        else blocks.push({ type: 'heading', runs: trimRuns(runs.filter((r) => r.text !== '\n')) });
        headingLevel = 0;
        continue;
      }
      const lines = splitLines(runs);
      if (!lines.length) continue;

      if (!counters.length) {
        const text = plainText(lines.flat());
        const isNote = /common paper/i.test(text) && /cc by/i.test(text);
        blocks.push({ type: isNote ? 'note' : 'para', runs: trimRuns(joinLines(lines)) });
        continue;
      }

      const level = counters.length - 1;
      const item = counters[counters.length - 1];
      item.paras = (item.paras || 0) + 1;

      // Second and later paragraphs of the same item: a lettered sub-clause
      // ("a. …") or an unnumbered continuation, never a repeat of the number.
      if (item.paras > 1) {
        for (const line of lines) {
          const trimmed = trimRuns(line);
          const m = plainText(trimmed).match(/^([a-z]{1,2}|[ivx]+)\.\s+/i);
          if (m) {
            trimmed[0].text = trimmed[0].text.slice(m[0].length);
            blocks.push({ type: 'clause', level: level + 1, label: `(${m[1].toLowerCase()})`, runs: trimRuns(trimmed) });
          } else {
            const prev = blocks[blocks.length - 1];
            if (prev && prev.type === 'clause' && prev.level > level) prev.runs = [...prev.runs, { text: ' ' }, ...trimmed];
            else blocks.push({ type: 'clause', level, label: '', runs: trimmed });
          }
        }
        continue;
      }

      const label = clauseLabel(counters);
      const [first, ...rest] = lines;
      const firstRuns = trimRuns(first);
      const isHeading = rest.length === 0 && firstRuns.every((r) => r.bold) && plainText(firstRuns).length < 80;
      blocks.push({ type: 'clause', level, label, runs: firstRuns, isHeading: isHeading && level === 0 });

      // Lettered sub-clauses ("a. …") are written as continuation lines in the
      // templates; lift them into their own clauses.
      for (const line of rest) {
        const trimmed = trimRuns(line);
        const m = plainText(trimmed).match(/^([a-z]{1,2}|[ivx]+)\.\s+/i);
        if (m) {
          trimmed[0].text = trimmed[0].text.slice(m[0].length);
          blocks.push({ type: 'clause', level: level + 1, label: `(${m[1].toLowerCase()})`, runs: trimRuns(trimmed) });
        } else {
          const prev = blocks[blocks.length - 1];
          prev.runs = [...prev.runs, { text: ' ' }, ...trimmed];
        }
      }
    }
  }
  return blocks;
}

function joinLines(lines) {
  const out = [];
  lines.forEach((l, i) => {
    if (i) out.push({ text: ' ' });
    out.push(...l);
  });
  return out;
}

function clauseLabel(counters) {
  const last = counters[counters.length - 1];
  if (last.bullet) return '•';
  const nums = counters.map((c) => c.n);
  if (nums.length === 1) return `${nums[0]}.`;
  if (nums.length === 2) return `${nums[0]}.${nums[1]}`;
  return `(${String.fromCharCode(96 + nums[nums.length - 1])})`;
}

/* ------------------------------------------------------------- the model */

export const SAMPLE_NOTICE =
  'Sample document for demonstration only. Not for use, not legal advice, and not to be signed.';

export function buildDocModel(specId, values = {}, { sample = DEMO_MODE } = {}) {
  const spec = getSpec(specId);
  if (!spec) throw new Error(`Unknown document type: ${specId}`);

  const [partyA, partyB] = partyLabels(spec, values);
  const missing = missingRequiredFields(spec, values);

  const keyTerms = spec.fields.map((field) => {
    const raw = values[field.key];
    const given = raw !== undefined && raw !== null && String(raw).trim() !== '';
    let value = given ? String(raw).trim() : field.default ? String(field.default) : null;
    if (value && field.type === 'date') value = formatDate(value);
    // A blank optional term means "none" in these agreements; only blank
    // required terms are outstanding.
    if (!value && !field.required) {
      if (/leave blank (for|if) none|default if left blank/i.test(field.hint)) return { label: field.label, value: 'None', none: true };
      if (/standard defaults/i.test(field.hint)) return { label: field.label, value: 'As set out in the Standard Terms', none: true };
      if (/only needed if/i.test(field.hint)) return { label: field.label, value: 'Not applicable', none: true };
    }
    return { label: field.label, value, required: field.required };
  });

  const effective = keyTerms.find((k, i) => spec.fields[i].key === 'effectiveDate')?.value || null;
  const termsUrl = spec.standardTermsUrl.replace(/^https?:\/\//, '');

  const draftText = missing.length
    ? `${missing.length} required term${missing.length === 1 ? ' is' : 's are'} still to be completed.`
    : '';
  // One notice box on the cover: the sample warning and/or the draft status.
  const notice = sample
    ? [SAMPLE_NOTICE, draftText].filter(Boolean).join(' ')
    : missing.length
      ? `Draft — ${draftText} Not for signature.`
      : null;

  return {
    spec,
    sample,
    notice,
    headerTag: sample ? 'Sample — not for use' : missing.length ? 'Draft — not for signature' : null,
    footerPrefix: sample ? 'SAMPLE, NOT FOR USE — ' : '',
    title: spec.name,
    shortName: spec.shortName,
    parties: [partyA, partyB],
    effectiveDate: effective,
    isDraft: missing.length > 0,
    missingCount: missing.length,
    intro: [
      { text: `This ${spec.shortName} consists of (1) this Cover Page and (2) the Common Paper ${spec.name} Standard Terms, Version ${spec.version}, as published at ` },
      { text: termsUrl, italic: true },
      { text: ' and reproduced in full below. Any modifications to the Standard Terms should be made on this Cover Page, which controls over any conflict with the Standard Terms.' },
    ],
    keyTerms,
    terms: parseTerms(readStandardTerms(spec.standardTerms)),
    signatureIntro: sample
      ? 'Sample only. These signature blocks show the layout of the final agreement and must not be signed.'
      : `By signing below, each party agrees to enter into this ${spec.shortName} as of the Effective Date.`,
    attribution: `Based on the Common Paper ${spec.name} (Version ${spec.version}), used under the Creative Commons Attribution 4.0 licence (CC BY 4.0). Modified from the original. Prepared with Prelegal. This document is not legal advice; consider having counsel review it before signing.${sample ? ` ${SAMPLE_NOTICE}` : ''}`,
    firm: FIRM,
  };
}
