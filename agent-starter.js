#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const DEFAULT_URL = 'http://127.0.0.1:4823';
let _child = null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function checkHealth(url) {
  try {
    const res = await fetch(new URL('/health', url).toString(), { method: 'GET' });
    if (!res.ok) return false;
    const body = await res.json();
    return !!body && body.ok;
  } catch (err) {
    return false;
  }
}

async function waitForHealth(url, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHealth(url)) return true;
    await sleep(250);
  }
  return false;
}

async function ensureAgentRunning({ url = process.env.CLAUDEB_AGENT_URL || DEFAULT_URL, agentPath = path.join(__dirname, 'claudeb-agent.js'), timeout = 5000, key = process.env.CLAUDEB_AGENT_KEY || '' } = {}) {
  process.env.CLAUDEB_AGENT_URL = url;
  if (key) process.env.CLAUDEB_AGENT_KEY = key;
  if (await checkHealth(url)) return { url, started: false, child: null };

  // spawn local agent
  const node = process.execPath;
  const child = spawn(node, [agentPath], { env: Object.assign({}, process.env), stdio: ['ignore', 'pipe', 'pipe'], cwd: path.dirname(agentPath) });
  _child = child;
  // Avoid writing agent output directly to stdout when parent is not an interactive TTY
  // (piped runs can cause readline to be closed). Instead, log to a temp file.
  const fs = require('fs');
  child.stdout?.on('data', (d) => {
    const s = `[claudeb-agent] ${d.toString()}`;
    if (process.stdout && process.stdout.isTTY) process.stdout.write(s);
    else {
      try { fs.appendFileSync('/tmp/claudeb-agent.log', s); } catch (e) { }
    }
  });
  child.stderr?.on('data', (d) => {
    const s = `[claudeb-agent] ${d.toString()}`;
    if (process.stderr && process.stderr.isTTY) process.stderr.write(s);
    else {
      try { fs.appendFileSync('/tmp/claudeb-agent.log', s); } catch (e) { }
    }
  });

  const ok = await waitForHealth(url, timeout);
  if (!ok) throw new Error('Agent did not become healthy in time');
  return { url, started: true, child };
}

function stopAgent() {
  if (_child && !_child.killed) {
    try { _child.kill(); } catch (e) { }
    _child = null;
  }
}

module.exports = { ensureAgentRunning, stopAgent };

process.on('exit', () => {
  try { stopAgent(); } catch (e) { }
});
