/**
 * Puter Claude API Utility
 * Provides functions to interact with Claude models via Puter.js
 */

const { getPuterInstance } = require('./puter-auth-helper');

let puter = null;

function initPuter(puterInstance = null) {
  if (puter) return puter;
  if (puterInstance) {
    puter = puterInstance;
    return puter;
  }
  puter = getPuterInstance();
  return puter;
}

const CLAUDE_MODELS = {
  'claude-fable-5': 'claude-fable-5',
  'claude-opus-4-8': 'claude-opus-4-8',
  'claude-opus-4.8-fast': 'claude-opus-4.8-fast',
  'claude-opus-4-7': 'claude-opus-4-7',
  'claude-opus-4-6': 'claude-opus-4-6',
  'claude-sonnet-4-6': 'claude-sonnet-4-6',
  'claude-sonnet-4-5': 'claude-sonnet-4-5',
  'claude-haiku-4-5': 'claude-haiku-4-5',
};

const https = require('https');
const { URL } = require('url');

async function callOpenRouterDirect(prompt, modelKey, apiKey) {
  // Simple OpenRouter /providers/chat completions call via Puter/OpenRouter unified model key
  // apiKey: if provided, will be used as Authorization: Bearer <apiKey>
  if (!modelKey) throw new Error('modelKey required for OpenRouter direct call');
  const ORIGIN = process.env.OPENROUTER_API_ORIGIN || 'https://api.openrouter.ai';
  const url = new URL('/v1/chat/completions', ORIGIN).toString();
  const body = JSON.stringify({ model: modelKey, messages: [{ role: 'user', content: prompt }], temperature: 0.2 });
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers }, (res) => {
      let s = '';
      res.on('data', (c) => s += c.toString());
      res.on('end', () => {
        try {
          const j = JSON.parse(s);
          resolve(j);
        } catch (e) {
          resolve(s);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateClaude(prompt, model = 'claude-sonnet-4-6', opts = {}) {
  const puterInstance = initPuter();
  const modelName = CLAUDE_MODELS[model] || model;
  // If user prefers direct OpenRouter calls (and key present), allow skipping Puter routing.
  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
  const preferOR = process.env.PUTER_PREFER_OPENROUTER === '1' || process.env.OPENROUTER_PREFER === '1' || process.env.PUTER_DIRECT_OPENROUTER === '1';
  const openrouterModel = process.env.OPENROUTER_FALLBACK_MODEL || process.env.PUTER_FALLBACK_MODEL || process.env.PUTER_FALLBACK || 'openrouter/free';
  if (openrouterKey && preferOR) {
    try {
      console.log('Preferring direct OpenRouter call (PUTER_PREFER_OPENROUTER=1)');
      const orResp = await callOpenRouterDirect(prompt, openrouterModel, openrouterKey);
      return orResp;
    } catch (err) {
      console.error('Direct OpenRouter initial call failed, falling back to Puter:', err && err.message ? err.message : err);
    }
  }
  try {
    const response = await puterInstance.ai.chat(prompt, Object.assign({ model: modelName }, opts));
    return response;
  } catch (error) {
    const msg = error?.message || String(error);
    const code = error?.code || error?.status || (error?.error && error.error.code) || '';
    console.error('Claude API Error:', msg);

    // Determine reason to try fallbacks: quota/usage, not found/missing model, or explicit force
    const isQuota = /no usage left|usage limit|quota|rate limit/i.test(msg) || /quota/i.test(code);
    const isNotFound = /not found|404|model not found|not_found/i.test(msg) || code === 'not_found' || code === 404;
    const forceFallback = process.env.PUTER_FORCE_FALLBACK === '1';

    const fallback = process.env.PUTER_FALLBACK_MODEL || process.env.PUTER_FALLBACK || 'openrouter/free';

    if (isQuota || isNotFound || forceFallback) {
      // If model not found on Puter, try a small set of known local Claude model fallbacks
      if (isNotFound) {
        const localFallbacks = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-fable-5'];
        for (const candidate of localFallbacks) {
          const candName = CLAUDE_MODELS[candidate] || candidate;
          if (!candName || candName === modelName) continue;
          try {
            console.log(`Model not found. Trying local fallback model via Puter: ${candName}`);
            const r = await puterInstance.ai.chat(prompt, Object.assign({ model: candName }, opts));
            return r;
          } catch (e) {
            // keep trying next candidate
            console.log(`Local fallback ${candName} failed: ${e && e.message ? e.message : String(e)}`);
          }
        }
      }
      // 1) Try Puter fallback model if configured
      if (fallback && fallback !== modelName) {
        try {
          console.log(`Falling back to model via Puter: ${fallback}`);
          const resp2 = await puterInstance.ai.chat(prompt, Object.assign({ model: fallback }, opts));
          return resp2;
        } catch (er2) {
          console.error('Puter fallback model failed:', er2?.message || er2);
        }
      }

      // 2) Try direct OpenRouter API if key available
      const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
      const openrouterModel = process.env.OPENROUTER_FALLBACK_MODEL || fallback || 'openrouter/free';
      if (openrouterKey) {
        try {
          console.log('Attempting direct OpenRouter call as fallback...');
          const orResp = await callOpenRouterDirect(prompt, openrouterModel, openrouterKey);
          return orResp;
        } catch (er3) {
          console.error('OpenRouter direct fallback failed:', er3?.message || er3);
        }
      } else {
        console.log('No OPENROUTER_API_KEY configured; skipping direct OpenRouter fallback.');
      }
    }

    // 3) As a last attempt, try the configured fallback regardless of error type
    if (fallback && fallback !== modelName) {
      try {
        console.log(`Attempting general Puter fallback to: ${fallback}`);
        const resp3 = await puterInstance.ai.chat(prompt, Object.assign({ model: fallback }, opts));
        return resp3;
      } catch (er4) {
        console.error('General Puter fallback failed:', er4?.message || er4);
      }
    }

    throw error;
  }
}

async function askClaude(message, model = 'claude-sonnet-4-6', opts = {}) {
  return generateClaude(message, model, opts);
}

function getAvailableModels() {
  return CLAUDE_MODELS;
}

module.exports = {
  initPuter,
  generateClaude,
  askClaude,
  getAvailableModels,
  CLAUDE_MODELS,
};

