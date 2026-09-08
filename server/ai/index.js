import { AI_MODE } from '../config.js';
import * as openrouterProvider from './openrouterProvider.js';
import * as mockProvider from './mockProvider.js';

const provider = AI_MODE === 'openrouter' ? openrouterProvider : mockProvider;

export const activeMode = AI_MODE;

/**
 * Run one assistant turn. Falls back to the mock provider if the OpenRouter
 * call fails, so a bad key or a network blip degrades instead of breaking the app.
 */
export async function runTurn(params) {
  try {
    return await provider.runTurn(params);
  } catch (err) {
    if (provider === mockProvider) throw err;
    console.error('[ai] OpenRouter request failed, falling back to mock:', err.message);
    const result = await mockProvider.runTurn(params);
    return {
      ...result,
      text: `_(The AI service is unavailable right now — falling back to the scripted interviewer.)_\n\n${result.text}`,
      degraded: true,
    };
  }
}
