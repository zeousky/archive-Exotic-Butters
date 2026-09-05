/**
 * Puter OpenRouter API Utility
 * Lightweight wrapper to call OpenRouter models via Puter.js
 */

const { getPuterInstance } = require('./puter-auth-helper');

let puter = null;
function initPuter(puterInstance = null) {
  if (puter) return puter;
  if (puterInstance) { puter = puterInstance; return puter; }
  puter = getPuterInstance();
  return puter;
}

const OPENROUTER_MODELS = {
  'openrouter/free': 'openrouter/free',
  'openai/gpt-oss-120b': 'openai/gpt-oss-120b',
  'openai/gpt-4': 'openai/gpt-4',
  'openai/gpt-5-codex': 'openai/gpt-5-codex',
  'z-ai/glm-5.1': 'z-ai/glm-5.1',
  'google/gemma-4-31b-it': 'google/gemma-4-31b-it',
};

async function generateOpenRouter(prompt, model = 'openrouter/free', opts = {}) {
  try {
    const p = initPuter();
    const modelName = OPENROUTER_MODELS[model] || model;
    const response = await p.ai.chat(prompt, Object.assign({ model: modelName }, opts));
    return response;
  } catch (err) {
    console.error('OpenRouter API Error:', err.message || err);
    throw err;
  }
}

function getAvailableModels() {
  return OPENROUTER_MODELS;
}

module.exports = { initPuter, generateOpenRouter, getAvailableModels, OPENROUTER_MODELS };
