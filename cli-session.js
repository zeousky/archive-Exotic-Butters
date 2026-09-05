const fs = require('fs');
const path = require('path');

const SESSIONS_DIR = path.join(process.cwd(), '.sessions');

async function ensureDir() {
  try {
    await fs.promises.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (err) {
    // ignore
  }
}

async function listSessions() {
  await ensureDir();
  try {
    const files = await fs.promises.readdir(SESSIONS_DIR);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  } catch (err) {
    return [];
  }
}

async function saveSession(name, data) {
  if (!name) throw new Error('Session name required');
  await ensureDir();
  const file = path.join(SESSIONS_DIR, `${name}.json`);
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

async function loadSession(name) {
  if (!name) throw new Error('Session name required');
  const file = path.join(SESSIONS_DIR, `${name}.json`);
  const raw = await fs.promises.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function deleteSession(name) {
  if (!name) throw new Error('Session name required');
  const file = path.join(SESSIONS_DIR, `${name}.json`);
  await fs.promises.unlink(file);
}

module.exports = {
  SESSIONS_DIR,
  listSessions,
  saveSession,
  loadSession,
  deleteSession,
};
