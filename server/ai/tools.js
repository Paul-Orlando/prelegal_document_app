import { DOCUMENT_SPECS, getSpec } from '../documentSpecs.js';

/**
 * Tool definitions handed to Claude. Both the real client and the mock produce
 * the same normalized "action" objects, so the rest of the app doesn't care
 * which one is running.
 */
export function buildTools(specId) {
  const spec = specId ? getSpec(specId) : null;

  const fieldKeys = spec ? spec.fields.map((f) => f.key) : [];

  const tools = [
    {
      name: 'set_document_type',
      description:
        'Record which supported agreement the user wants to create. Call this as soon as you know ' +
        'the document type. Only these ids are valid: ' +
        DOCUMENT_SPECS.map((s) => s.id).join(', ') +
        '.',
      input_schema: {
        type: 'object',
        properties: {
          document_type_id: {
            type: 'string',
            enum: DOCUMENT_SPECS.map((s) => s.id),
            description: 'The id of the agreement to create.',
          },
        },
        required: ['document_type_id'],
        additionalProperties: false,
      },
    },
  ];

  if (spec) {
    tools.push({
      name: 'set_fields',
      description:
        'Record one or more answers onto the document. Call this whenever the user supplies or ' +
        'changes information. You may set several fields in one call. Never invent values the ' +
        'user did not give you.',
      input_schema: {
        type: 'object',
        properties: {
          fields: {
            type: 'array',
            description: 'The fields to set.',
            items: {
              type: 'object',
              properties: {
                key: {
                  type: 'string',
                  enum: fieldKeys,
                  description: 'The field to set.',
                },
                value: {
                  type: 'string',
                  description: 'The value, in the words the user gave you.',
                },
              },
              required: ['key', 'value'],
              additionalProperties: false,
            },
          },
        },
        required: ['fields'],
        additionalProperties: false,
      },
    });

    tools.push({
      name: 'mark_complete',
      description:
        'Mark the document ready for download. Only call this once every required field has a ' +
        'value and the user has confirmed they are done.',
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
    });
  }

  return tools;
}

/** Normalize a raw tool_use block into an internal action. */
export function toAction(name, input) {
  switch (name) {
    case 'set_document_type':
      return { type: 'set_document_type', documentTypeId: input?.document_type_id };
    case 'set_fields': {
      const fields = {};
      for (const entry of input?.fields ?? []) {
        if (entry && typeof entry.key === 'string') fields[entry.key] = String(entry.value ?? '');
      }
      return { type: 'set_fields', fields };
    }
    case 'mark_complete':
      return { type: 'mark_complete' };
    default:
      return null;
  }
}
