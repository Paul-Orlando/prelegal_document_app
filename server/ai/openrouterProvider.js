import Client from 'openai';
import { MODEL, OPENROUTER_API_KEY } from '../config.js';
import { SYSTEM_BASE, buildStateBlock } from './prompt.js';
import { buildTools, toAction } from './tools.js';

const client = new Client({
  apiKey: OPENROUTER_API_KEY || undefined,
  baseURL: 'https://openrouter.ai/api/v1',
});

const MAX_TOOL_ROUNDS = 6;

/** Convert our Anthropic-shaped tool defs (name/description/input_schema) to
 * the function-calling shape OpenRouter's Chat Completions API expects. */
function toChatTools(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

function systemMessage(specId, values) {
  return { role: 'system', content: `${SYSTEM_BASE}\n\n${buildStateBlock(specId, values)}` };
}

/**
 * Run one assistant turn against OpenRouter's Chat Completions API.
 *
 * Tool calls mutate document state, so we drive the loop ourselves: after
 * each round of tool calls, `applyAction` persists the change and the system
 * message is rebuilt so the next round sees current state.
 *
 * @param {object}   params
 * @param {string?}  params.specId     Current document type, or null.
 * @param {object}   params.values     Current field values.
 * @param {object[]} params.history    Prior turns as [{role, content}].
 * @param {string}   params.userMessage
 * @param {(action: object) => {specId: string|null, values: object}} params.applyAction
 * @returns {Promise<{text: string, actions: object[]}>}
 */
export async function runTurn({ specId, values, history, userMessage, applyAction }) {
  let currentSpecId = specId;
  let currentValues = values;

  const messages = [
    systemMessage(currentSpecId, currentValues),
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const actions = [];
  const textParts = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Refresh the system message every round so tool results from the
    // previous round are reflected before the model's next turn.
    messages[0] = systemMessage(currentSpecId, currentValues);

    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: toChatTools(buildTools(currentSpecId)),
    });

    const choice = response.choices[0];
    const message = choice.message;

    if (message.content && message.content.trim()) textParts.push(message.content.trim());

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) break;

    // OpenRouter's Chat Completions API requires the assistant message
    // (with its tool_calls) echoed back before the matching tool results.
    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: toolCalls });

    for (const call of toolCalls) {
      let input = {};
      try {
        input = JSON.parse(call.function.arguments || '{}');
      } catch {
        // Malformed arguments — fall through with an empty input; toAction
        // will produce a no-op action and the model gets an error to recover from.
      }
      const action = toAction(call.function.name, input);
      let resultText = 'Unknown tool.';
      if (action) {
        try {
          const state = applyAction(action);
          currentSpecId = state.specId;
          currentValues = state.values;
          actions.push(action);
          resultText = 'OK';
        } catch (err) {
          resultText = `Error: ${err.message}`;
        }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: resultText });
    }

    if (choice.finish_reason !== 'tool_calls') break;
  }

  const text =
    textParts.join('\n\n').trim() ||
    "Got it — I've recorded that. What would you like to do next?";

  return { text, actions };
}
