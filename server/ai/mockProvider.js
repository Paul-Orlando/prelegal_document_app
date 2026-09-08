import { DOCUMENT_SPECS, getSpec, matchSpec, missingRequiredFields } from '../documentSpecs.js';

/**
 * A deterministic, rule-based stand-in for the Claude provider.
 *
 * It is not conversational — it walks the required fields in order — but it
 * exercises exactly the same action pipeline, so the whole app runs and is
 * testable without an API key. Used automatically when ANTHROPIC_API_KEY is
 * unset, or when PRELEGAL_AI_MODE=mock.
 */

const DECLINES = new Set(['skip', 'none', 'n/a', 'na', 'no', '-', 'later', 'pass']);
const ACCEPTS = new Set(['yes', 'y', 'ok', 'okay', 'sure', 'default', 'yep', 'sounds good']);

const catalogList = () =>
  DOCUMENT_SPECS.map((s) => `  • ${s.name} — ${s.description.split('.')[0]}.`).join('\n');

function ask(spec, values) {
  const missing = missingRequiredFields(spec, values);
  if (missing.length === 0) {
    const emptyOptional = spec.fields
      .filter((f) => !f.required)
      .filter((f) => !String(values[f.key] ?? '').trim())
      .map((f) => f.label);
    let text = `That's everything required for your ${spec.name}. You can download it now.`;
    if (emptyOptional.length) {
      text += `\n\nOptional fields still empty: ${emptyOptional.join(', ')}. Say "done" to finish, or tell me any of these if you'd like them filled in.`;
    } else {
      text += `\n\nSay "done" to finish.`;
    }
    return text;
  }
  const field = spec.fields.find((f) => f.key === missing[0]);
  let text = `**${field.label}** — ${field.hint}`;
  if (field.default) text += `\n\nSuggested default: "${field.default}". Reply "yes" to accept it.`;
  return text;
}

export async function runTurn({ specId, values, history, userMessage, applyAction }) {
  const input = String(userMessage ?? '').trim();
  const lower = input.toLowerCase();
  const actions = [];
  let currentSpecId = specId;
  let currentValues = values;

  const apply = (action) => {
    const state = applyAction(action);
    currentSpecId = state.specId;
    currentValues = state.values;
    actions.push(action);
  };

  // ---------------------------------------------------- pick a document type
  if (!currentSpecId) {
    const match = matchSpec(input);
    if (!match) {
      return {
        text:
          `I can't tell which document you need from that.\n\n` +
          `Here's what I can generate:\n${catalogList()}\n\n` +
          `Which of these would you like? (If you were after something else — an employment ` +
          `contract or a lease, say — I can't produce those, but I can point you at the closest fit.)`,
        actions,
      };
    }
    apply({ type: 'set_document_type', documentTypeId: match.id });
    const spec = getSpec(match.id);
    return {
      text: `Good — a **${spec.name}**. ${spec.description}\n\nLet's fill in the details.\n\n${ask(spec, currentValues)}`,
      actions,
    };
  }

  const spec = getSpec(currentSpecId);
  const missing = missingRequiredFields(spec, currentValues);

  // ------------------------------------------------------------- completion
  if (missing.length === 0 && (lower === 'done' || lower === 'finish' || lower === 'complete')) {
    apply({ type: 'mark_complete' });
    return { text: `Done — your ${spec.name} is ready to download.`, actions };
  }

  if (!input) {
    return { text: ask(spec, currentValues), actions };
  }

  // ------------------------------------------- treat input as a field answer
  if (missing.length > 0) {
    const field = spec.fields.find((f) => f.key === missing[0]);

    if (DECLINES.has(lower)) {
      return {
        text: `**${field.label}** is required, so I do need a value for it.\n\n${field.hint}`,
        actions,
      };
    }

    const value = ACCEPTS.has(lower) && field.default ? String(field.default) : input;
    apply({ type: 'set_fields', fields: { [field.key]: value } });

    const nextSpec = getSpec(currentSpecId);
    return { text: `Recorded **${field.label}**: ${value}\n\n${ask(nextSpec, currentValues)}`, actions };
  }

  // All required fields done — accept optional answers by label match.
  const optional = spec.fields.filter((f) => !f.required);
  const labelMatch = optional.find((f) => lower.startsWith(f.label.toLowerCase()));
  if (labelMatch) {
    const value = input.slice(labelMatch.label.length).replace(/^[:\-\s]+/, '').trim();
    if (value) {
      apply({ type: 'set_fields', fields: { [labelMatch.key]: value } });
      return { text: `Recorded **${labelMatch.label}**: ${value}\n\n${ask(getSpec(currentSpecId), currentValues)}`, actions };
    }
  }

  return {
    text:
      `${ask(spec, currentValues)}\n\n_(Running without an API key, so I'm following a fixed script. ` +
      `To fill an optional field, start your message with its name — for example "Technical support: email only".)_`,
    actions,
  };
}
