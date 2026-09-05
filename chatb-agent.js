#!/usr/bin/env node
/*
  Simple local HTTP agent for Claudeb to expose workspace file operations.
  - Run with CLAUDEB_AGENT_KEY set to a secret token to require auth.
  - Default port: 4823 (CLAUDEB_AGENT_PORT)
  - Root workspace: current working directory or CLAUDEB_AGENT_ROOT
*/

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.CLAUDEB_AGENT_PORT || '4823', 10);
const ROOT = path.resolve(process.env.CLAUDEB_AGENT_ROOT || process.cwd());
const KEY = process.env.CLAUDEB_AGENT_KEY || '';

function sendJSON(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function unauthorized(res) {
  sendJSON(res, { ok: false, error: 'unauthorized' }, 401);
}

function safeResolve(p) {
  if (!p) throw new Error('Missing path');
  const resolved = path.resolve(ROOT, '.' + path.sep + p);
  if (!resolved.startsWith(ROOT)) throw new Error('Path outside workspace root');
  return resolved;
}

function getAuthToken(req) {
  const hdr = req.headers['x-claudeb-agent-key'] || req.headers['x-agent-key'];
  if (hdr) return hdr;
  const auth = req.headers['authorization'];
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

function checkAuth(req) {
  if (!KEY) return true; // no key required
  const t = getAuthToken(req);
  return t === KEY;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c.toString(); });
    req.on('end', () => {
      if (!s) return resolve({});
      try { resolve(JSON.parse(s)); } catch (err) { resolve({ raw: s }); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const base = `http://${req.headers.host || '127.0.0.1'}`;
  const parsed = new URL(req.url, base);
  if (!checkAuth(req)) return unauthorized(res);

  try {
    if (req.method === 'GET' && parsed.pathname === '/read') {
      const p = parsed.searchParams.get('path');
      const file = safeResolve(p || '.');
      const stat = await fs.promises.stat(file);
      if (stat.isDirectory()) {
        const list = await fs.promises.readdir(file);
        return sendJSON(res, { ok: true, type: 'directory', path: path.relative(ROOT, file), list });
      }
      const content = await fs.promises.readFile(file, 'utf8');
      return sendJSON(res, { ok: true, type: 'file', path: path.relative(ROOT, file), content });
    }

    if (req.method === 'GET' && parsed.pathname === '/list') {
      const p = parsed.searchParams.get('path') || '.';
      const dir = safeResolve(p);
      const list = await fs.promises.readdir(dir, { withFileTypes: true });
      const out = list.map(d => ({ name: d.name, type: d.isDirectory() ? 'dir' : 'file' }));
      return sendJSON(res, { ok: true, path: path.relative(ROOT, dir), list: out });
    }

    if (req.method === 'POST' && parsed.pathname === '/write') {
      const body = await readBody(req);
      const p = body.path;
      if (!p) return sendJSON(res, { ok: false, error: 'path required' }, 400);
      const file = safeResolve(p);
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      await fs.promises.writeFile(file, body.content || '', 'utf8');
      return sendJSON(res, { ok: true, path: path.relative(ROOT, file) });
    }

    if (req.method === 'POST' && parsed.pathname === '/delete') {
      const body = await readBody(req);
      const p = body.path;
      if (!p) return sendJSON(res, { ok: false, error: 'path required' }, 400);
      const file = safeResolve(p);
      await fs.promises.rm(file, { recursive: true, force: true });
      return sendJSON(res, { ok: true });
    }

    if (req.method === 'GET' && parsed.pathname === '/stat') {
      const p = parsed.searchParams.get('path');
      const file = safeResolve(p || '.');
      const stat = await fs.promises.stat(file);
      return sendJSON(res, { ok: true, stat: { isFile: stat.isFile(), isDirectory: stat.isDirectory(), size: stat.size, mtime: stat.mtime } });
    }

    if (req.method === 'POST' && parsed.pathname === '/mkdir') {
      const body = await readBody(req);
      const p = body.path;
      if (!p) return sendJSON(res, { ok: false, error: 'path required' }, 400);
      const dir = safeResolve(p);
      await fs.promises.mkdir(dir, { recursive: true });
      return sendJSON(res, { ok: true, path: path.relative(ROOT, dir) });
    }

    if (req.method === 'GET' && parsed.pathname === '/health') {
      return sendJSON(res, { ok: true, root: ROOT });
    }

    sendJSON(res, { ok: false, error: 'unknown endpoint' }, 404);
  } catch (err) {
    sendJSON(res, { ok: false, error: String(err.message || err) }, 500);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ClaudeB agent listening on http://127.0.0.1:${PORT}`);
  if (KEY) console.log('CLAUDEB_AGENT_KEY is required for requests.');
  console.log(`Workspace root: ${ROOT}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down agent.');
  server.close();
  process.exit(0);
});
