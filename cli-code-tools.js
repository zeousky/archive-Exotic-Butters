/**
 * Shared CLI code tools for formatting, explaining, refactoring, and test generation.
 */

const fs = require('fs');
const path = require('path');
const { getPuterInstance } = require('./puter-auth-helper');

async function agentFetchJson(method, endpoint, body) {
  const AGENT_URL = process.env.CLAUDEB_AGENT_URL || '';
  const AGENT_KEY = process.env.CLAUDEB_AGENT_KEY || '';
  if (!AGENT_URL) throw new Error('No CLAUDEB_AGENT_URL configured');
  const url = new URL(endpoint, AGENT_URL).toString();
  const headers = { 'Content-Type': 'application/json' };
  if (AGENT_KEY) headers['Authorization'] = `Bearer ${AGENT_KEY}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  return data;
}

function detectLanguage(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'javascript';
  if (ext === '.ts') return 'typescript';
  if (ext === '.py') return 'python';
  if (ext === '.go') return 'go';
  if (ext === '.java') return 'java';
  if (ext === '.rs') return 'rust';
  if (ext === '.sh') return 'shell';
  return 'text';
}

async function readFileContent(filePath) {
  const AGENT_URL = process.env.CLAUDEB_AGENT_URL || '';
  const AGENT_KEY = process.env.CLAUDEB_AGENT_KEY || '';
  if (AGENT_URL) {
    // Use query param via URL
    const u = new URL('/read', AGENT_URL);
    u.searchParams.set('path', filePath);
    const headers = {};
    if (AGENT_KEY) headers['Authorization'] = `Bearer ${AGENT_KEY}`;
    const r = await fetch(u.toString(), { method: 'GET', headers });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'agent read failed');
    if (data.type === 'directory') throw new Error('Path is a directory');
    return data.content || '';
  }
  return fs.promises.readFile(filePath, 'utf8');
}

async function writeFileContent(filePath, content) {
  const AGENT_URL = process.env.CLAUDEB_AGENT_URL || '';
  if (AGENT_URL) {
    const body = { path: filePath, content };
    const data = await agentFetchJson('POST', '/write', body);
    if (!data.ok) throw new Error(data.error || 'agent write failed');
    return;
  }
  return fs.promises.writeFile(filePath, content, 'utf8');
}

// Read only a small snippet (first `limit` bytes/chars) of a file to build an index
async function readFileSnippet(filePath, limit = 1024) {
  const AGENT_URL = process.env.CLAUDEB_AGENT_URL || '';
  const AGENT_KEY = process.env.CLAUDEB_AGENT_KEY || '';
  if (AGENT_URL) {
    const u = new URL('/read', AGENT_URL);
    u.searchParams.set('path', filePath);
    u.searchParams.set('limit', String(limit));
    const headers = {};
    if (AGENT_KEY) headers['Authorization'] = `Bearer ${AGENT_KEY}`;
    const r = await fetch(u.toString(), { method: 'GET', headers });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'agent read failed');
    if (data.type === 'directory') throw new Error('Path is a directory');
    return (data.content || '').slice(0, limit);
  }
  // Local FS: open and read only required bytes
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    const length = Math.min(limit, size);
    const { buffer } = await handle.read(Buffer.alloc(length), 0, length, 0);
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
}

async function callModel(prompt, modelKey) {
  const puter = getPuterInstance();
  return puter.ai.chat(prompt, { model: modelKey });
}

async function formatCode({ code, filePath, modelKey }) {
  const lang = detectLanguage(filePath);
  const instruction = `You are a code formatter. Format the following ${lang} code. Return ONLY the formatted code, with no commentary.`;
  const prompt = `${instruction}\n\n${code}`;
  const resp = await callModel(prompt, modelKey);
  if (resp?.message?.content) return resp.message.content[0]?.text || resp.message.content;
  return resp.toString?.() || String(resp);
}

async function explainCode({ code, filePath, modelKey }) {
  const lang = detectLanguage(filePath);
  const instruction = `You are an expert ${lang} engineer. Explain the following code in clear, concise terms for another developer. Highlight purpose, inputs, outputs, and any potential issues.`;
  const prompt = `${instruction}\n\n${code}`;
  const resp = await callModel(prompt, modelKey);
  if (resp?.message?.content) return resp.message.content[0]?.text || resp.message.content;
  return resp.toString?.() || String(resp);
}

async function refactorCode({ code, filePath, modelKey }) {
  const lang = detectLanguage(filePath);
  const instruction = `You are a senior ${lang} engineer. Refactor the following code to improve readability, maintainability, and performance while preserving behavior. Add brief comments where helpful. Return ONLY the refactored code.`;
  const prompt = `${instruction}\n\n${code}`;
  const resp = await callModel(prompt, modelKey);
  if (resp?.message?.content) return resp.message.content[0]?.text || resp.message.content;
  return resp.toString?.() || String(resp);
}

async function generateTests({ code, filePath, modelKey }) {
  const lang = detectLanguage(filePath);
  const instruction = `You are a software engineer. Generate unit tests for the following ${lang} code. Use common testing frameworks (jest for javascript, pytest for python). Return ONLY the test file content.`;
  const prompt = `${instruction}\n\n${code}`;
  const resp = await callModel(prompt, modelKey);
  if (resp?.message?.content) return resp.message.content[0]?.text || resp.message.content;
  return resp.toString?.() || String(resp);
}

module.exports = {
  detectLanguage,
  readFileContent,
  writeFileContent,
  readFileSnippet,
  formatCode,
  explainCode,
  refactorCode,
  generateTests,
};
