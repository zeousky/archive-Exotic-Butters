#!/usr/bin/env node

/**
 * Claudeb - Interactive Claude AI Interface (Enhanced)
 * - Session persistence (.sessions/)
 * - Commands (:help, :model, :save, :resume, :list, :history, :show, :exit)
 * - Pending spinner while waiting for responses
 * - Session analytics removed
 */

const readline = require('readline');
const { generateClaude, CLAUDE_MODELS } = require('./puter-chat');
const sessionManager = require('./cli-session');
const { getPuterInstance } = require('./puter-auth-helper');
const agentStarter = require('./agent-starter');

// Create readline only as a real terminal when stdin is a TTY.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });

const util = require('node:util');

process.on('unhandledRejection', (reason) => {
  try {
    // Avoid deep inspection of potentially huge objects - print concise message only.
    const msg = reason && reason.message ? reason.message : String(reason);
    console.error('\nUnhandledPromiseRejection detected:', msg);
  } catch (e) {
    try { console.error('UnhandledPromiseRejection reason:', String(reason)); } catch (_) { console.error('UnhandledPromiseRejection'); }
  }
});

process.on('uncaughtException', (err) => {
  console.error('\nUncaughtException:', err && err.stack ? err.stack : err);
  process.exit(1);
});

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

let session = { name: null, model: 'claude-sonnet-4-6', history: [], effort: 'high', agentMode: false };
// Behavior toggles
let devMode = false;
let multilineMode = false;
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Batch mode: if stdin is not a TTY, read all input upfront and process lines without readline
let BATCH_MODE = false;
let BATCH_LINES = [];
if (!process.stdin.isTTY) {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    BATCH_LINES = raw.replace(/\r/g, '\n').split('\n').map(s => s.replace(/\u0000/g, '')).filter(Boolean);
    BATCH_MODE = BATCH_LINES.length > 0;
  } catch (e) { BATCH_MODE = false; }
}

// Helper: list code files in workspace (uses agent if available)
async function listWorkspaceCodeFiles(dir = '.') {
  const AGENT_URL = process.env.CLAUDEB_AGENT_URL || '';
  const AGENT_KEY = process.env.CLAUDEB_AGENT_KEY || '';
  const results = [];
  async function walk(cur) {
    if (AGENT_URL) {
      const u = new URL('/list', AGENT_URL);
      u.searchParams.set('path', cur);
      const headers = {};
      if (AGENT_KEY) headers['Authorization'] = `Bearer ${AGENT_KEY}`;
      const res = await fetch(u.toString(), { method: 'GET', headers });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'agent list failed');
      for (const e of data.list) {
        const childPath = cur === '.' ? e.name : `${cur}/${e.name}`;
        if (e.type === 'dir') await walk(childPath);
        else if (/\.(js|ts|py|go|java|rs|c|cpp|h|jsx|tsx|json|md|html|css|sh)$/.test(e.name)) results.push(childPath);
      }
    } else {
      const dirPath = path.resolve(process.cwd(), cur);
      let list = [];
      try { list = await fs.promises.readdir(dirPath, { withFileTypes: true }); } catch (err) { return; }
      for (const e of list) {
        const childPath = cur === '.' ? e.name : `${cur}/${e.name}`;
        if (e.isDirectory()) await walk(childPath);
        else if (/\.(js|ts|py|go|java|rs|c|cpp|h|jsx|tsx|json|md|html|css|sh)$/.test(e.name)) results.push(childPath);
      }
    }
  }
  await walk(dir);
  return results;
}

async function chooseFilesFromList(files) {
  if (!files || !files.length) return [];
  const max = Math.min(files.length, 200);
  console.log(`${colors.bright}Found ${files.length} code files. Showing first ${max}:${colors.reset}`);
  for (let i = 0; i < max; i++) console.log(`${colors.green}[${i+1}]${colors.reset} ${files[i]}`);
  const selRaw = (await promptUser('Select files by number (e.g. 1,3) or "all" or press Enter to cancel: '));
  if (!selRaw) return [];
  const sel = selRaw.trim().toLowerCase();
  if (!sel) return [];
  // Safety: avoid blindly sending thousands of files. Default to a reasonable cap.
  const MAX_SEND_FILES = 50;
  if (sel === 'all' || sel === 'a') {
    if (files.length > MAX_SEND_FILES) {
      const conf = (await promptUser(`Found ${files.length} files. Attaching all may exceed model limits and your usage. By default I'll attach the first ${MAX_SEND_FILES}. To attach ALL files type ALL (uppercase) now, otherwise press Enter to proceed with first ${MAX_SEND_FILES}: `)).trim();
      if (conf === 'ALL') return files;
      return files.slice(0, MAX_SEND_FILES);
    }
    return files;
  }
  const parts = sel.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= files.length);
  // Unique and map
  const uniq = Array.from(new Set(parts));
  return uniq.map(n => files[n-1]);
}

async function fetchFilesContent(selected) {
  const out = [];
  const PER_FILE_LIMIT = 64 * 1024; // 64 KB per file
  const TOTAL_LIMIT = 512 * 1024; // 512 KB total
  let total = 0;
  for (const f of selected) {
    try {
      let content = await codeTools.readFileContent(f);
      if (typeof content !== 'string') content = String(content || '');
      let truncated = false;
      if (content.length > PER_FILE_LIMIT) { content = content.slice(0, PER_FILE_LIMIT); truncated = true; }
      out.push({ path: f, content, truncated });
      total += content.length;
      if (total > TOTAL_LIMIT) {
        console.log(`${colors.yellow}Reached combined attachment limit (${Math.round(TOTAL_LIMIT/1024)}KB). Stopping additional files.${colors.reset}`);
        break;
      }
    } catch (err) {
      console.log(`${colors.yellow}Failed to read ${f}: ${err.message}${colors.reset}`);
    }
  }
  return out;
}

// Save given content to a file in workspace (uses agent via codeTools when available)
async function saveContentToFile(content, suggestedName) {
  if (!content) { console.log(`${colors.yellow}No content to save.${colors.reset}`); return; }
  let filename = (suggestedName || '').trim();
  if (!filename) filename = (await promptUser('File path to save to: ')).trim();
  if (!filename) { console.log(`${colors.yellow}Aborted.${colors.reset}`); return; }
  // Check for existing file
  let exists = false;
  try {
    await codeTools.readFileContent(filename);
    exists = true;
  } catch (e) { /* not found or unreadable - proceed */ }
  if (exists) {
    const ok = (await promptUser(`File ${filename} exists. Overwrite? (y/N): `)).trim().toLowerCase();
    if (ok !== 'y' && ok !== 'yes') { console.log(`${colors.yellow}Cancelled.${colors.reset}`); return; }
  }
  try {
    await codeTools.writeFileContent(filename, content);
    console.log(`${colors.green}Saved content to ${filename}.${colors.reset}`);
  } catch (err) {
    console.log(`${colors.red}Failed to write file: ${err.message || err}${colors.reset}`);
  }
}

// Interactive write: prompt user to enter file content, finish with a single '.' on its own line
async function writeFileInteractive(initialPath) {
  let filePath = (initialPath || '').trim();
  if (!filePath) filePath = (await promptUser('File path to write: ')).trim();
  if (!filePath) { console.log(`${colors.yellow}Aborted.${colors.reset}`); return; }
  console.log(`${colors.dim}Enter content. End with a single line containing only a dot (.) to finish.${colors.reset}`);
  const lines = [];
  while (true) {
    const line = await promptUser('');
    if (line === '.') break;
    lines.push(line);
  }
  const content = lines.join('\n');
  await saveContentToFile(content, filePath);
}

function printHeader() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║        CLAUDEB - CLAUDE INTERFACE      ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);
  console.log(`${colors.dim}Type /help for commands. Current model: ${colors.bright}${session.model}${colors.reset}${colors.dim}${session.name ? '  •  Session: ' + session.name : ''}${colors.reset}\n`);
}

function printModels() {
  console.log(`${colors.bright}Available Claude Models:${colors.reset}\n`);
  const models = Object.keys(CLAUDE_MODELS);
  models.forEach((key, index) => {
    console.log(`${colors.green}[${index + 1}]${colors.reset} ${colors.bright}${key}${colors.reset}`);
  });
  console.log();
}

function printHelp() {
  console.log(`${colors.bright}Commands:${colors.reset}`);
  console.log(`${colors.yellow}/help${colors.reset}        - Show this help`);
  console.log(`${colors.yellow}/model${colors.reset}       - Change or show current model (e.g. "/model 2" or "/model claude-sonnet-4-6")`);
  console.log(`${colors.yellow}/save <name>${colors.reset} - Save current session to .sessions/<name>.json`);
  console.log(`${colors.yellow}/resume <name>${colors.reset} - Load a saved session`);
  console.log(`${colors.yellow}/list${colors.reset}        - List saved sessions`);
  console.log(`${colors.yellow}/history${colors.reset}     - Show recent prompts/responses`);
  console.log(`${colors.yellow}/show <n>${colors.reset}   - Show history entry number n`);
  console.log(`${colors.yellow}/exit${colors.reset}        - Exit the CLI\n`);
}

// Code-related helpers
const codeTools = require('./cli-code-tools');

// Extend help with coding tools
const _oldHelp = printHelp;
function printHelpExtended() {
  _oldHelp();
  console.log(`${colors.yellow}/format <file>${colors.reset} - Format a code file using the current model`);
  console.log(`${colors.yellow}/explain <file|n>${colors.reset} - Explain a file or a history entry`);
  console.log(`${colors.yellow}/refactor <file|n>${colors.reset} - Refactor a file or a history entry`);
  console.log(`${colors.yellow}/tests <file|n>${colors.reset} - Generate unit tests for a file or history entry`);
  console.log(`${colors.yellow}/multiline on|off${colors.reset} - Toggle multi-line prompt mode (default: off - single Enter sends)`);
  console.log(`${colors.yellow}/devmode on|off${colors.reset}  - Toggle developer mode (more direct responses, still safe)`);
  console.log(`${colors.yellow}/run <cmd>${colors.reset}      - Run a shell command (you will be asked to confirm if potentially dangerous)`);
  console.log(`${colors.yellow}/npm-test${colors.reset}        - Run 'npm test' in workspace`);
  console.log(`${colors.yellow}/git-status${colors.reset}     - Run 'git status --short'`);
  console.log(`${colors.yellow}/nofilter${colors.reset}       - Explain why removing safety filters is not allowed`);
  console.log(`${colors.yellow}/effort <low|medium|high>${colors.reset} - Set AI effort level (default: high)`);
  console.log(`${colors.yellow}/save-last <path>${colors.reset} - Save last generated result to a file (or use natural language 'name it <file>')`);
  console.log(`${colors.yellow}/write <path>${colors.reset}     - Create or edit a file interactively and save to workspace`);
}

function promptUser(question) {
  return new Promise((resolve) => {
    // If stdin isn't interactive or readline has been closed, don't attempt to ask - return empty.
    if (!process.stdin.isTTY || (rl && rl.closed)) return resolve('');
    // If running in batch mode but no lines left, return empty quickly.
    if (!process.stdin.isTTY && BATCH_MODE && BATCH_LINES.length === 0) return resolve('');
    try {
      rl.question(question, (a) => resolve(a));
    } catch (err) {
      // Defensive: avoid printing huge stacks that can blow memory; show short message.
      console.error(`${colors.yellow}promptUser: readline closed or error: ${err && err.message ? err.message : String(err)}${colors.reset}`);
      return resolve('');
    }
  });
}

function startSpinner(message = 'Processing') {
  const spinner = ['|', '/', '-', '\\'];
  let i = 0;
  process.stdout.write(`${message} `);
  const id = setInterval(() => {
    process.stdout.write('\b' + spinner[i % spinner.length]);
    i++;
  }, 80);
  return () => {
    clearInterval(id);
    process.stdout.write('\b');
    process.stdout.write(' \n');
  };
}

async function selectModelInteractive() {
  console.log(`${colors.bright}Select a model:${colors.reset}`);
  console.log(`${colors.dim}(Enter number, model key, or press Enter for current)${colors.reset}\n`);
  printModels();
  let input;
  if (BATCH_MODE) {
    input = (BATCH_LINES.shift() || '').trim();
  } else {
    input = await promptUser(`${colors.cyan}? Model ${colors.reset}`);
  }
  const modelKeys = Object.keys(CLAUDE_MODELS);
  const choice = input.trim();
  if (!choice) return session.model;
  const asNum = parseInt(choice, 10);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= modelKeys.length) {
    session.model = modelKeys[asNum - 1];
    return session.model;
  }
  if (CLAUDE_MODELS[choice]) {
    session.model = choice;
    return session.model;
  }
  console.log(`${colors.yellow}Invalid choice, keeping current model: ${session.model}${colors.reset}`);
  return session.model;
}

async function getInput() {
  if (BATCH_MODE) {
    const first = BATCH_LINES.shift() || '';
    const t = first.trim();
    if (t === '/') return { type: 'command', command: 'help', args: '' };
    if (t === '') return { type: 'empty' };
    if (t.startsWith('/')) {
      const [cmd, ...rest] = t.slice(1).split(' ');
      const args = rest.join(' ').trim();
      return { type: 'command', command: cmd.toLowerCase(), args };
    }
    // Natural-language detection for saving the last generated result
    const saveMatch = t.match(/(?:name it|save as|save to|write to|create file|save file as)\s+["']?([^"'\s]+)["']?/i);
    if (saveMatch) {
      const filename = saveMatch[1];
      return { type: 'command', command: 'save-last', args: filename };
    }
    if (t.toLowerCase() === 'exit') return { type: 'command', command: 'exit', args: '' };
    if (!multilineMode) return { type: 'prompt', text: first };
    const lines = [first];
    while (BATCH_LINES.length) {
      const line = BATCH_LINES.shift();
      if (line === '') break;
      lines.push(line);
    }
    return { type: 'prompt', text: lines.join('\n') };
  }
  const first = await promptUser(`${colors.cyan}> ${colors.reset}`);
  if (first === null) return null;
  const t = first.trim();
  if (t === '/') return { type: 'command', command: 'help', args: '' };
  if (t === '') return { type: 'empty' };
  if (t.startsWith('/')) {
    const [cmd, ...rest] = t.slice(1).split(' ');
    const args = rest.join(' ').trim();
    return { type: 'command', command: cmd.toLowerCase(), args };
  }
  // Natural-language detection for saving the last generated result
  const saveMatch = t.match(/(?:name it|save as|save to|write to|create file|save file as)\s+["']?([^"'\s]+)["']?/i);
  if (saveMatch) {
    const filename = saveMatch[1];
    return { type: 'command', command: 'save-last', args: filename };
  }
  if (t.toLowerCase() === 'exit') return { type: 'command', command: 'exit', args: '' };
  if (!multilineMode) return { type: 'prompt', text: first };
  const lines = [first];
  while (true) {
    const line = await promptUser('');
    if (line === '') break;
    lines.push(line);
  }
  return { type: 'prompt', text: lines.join('\n') };
}

function extractContent(response) {
  if (!response) return '';
  if (typeof response === 'string') return response;
  if (response.message && response.message.content) {
    if (Array.isArray(response.message.content)) {
      return response.message.content.map(c => c.text || c).join('\n');
    }
    return response.message.content;
  }
  if (response.toString) return response.toString();
  return JSON.stringify(response);
}

async function generate(prompt) {
  try {
    // Auto-attach workspace files when in agent mode and user asks to review "my code"
    let promptToSend = prompt;
    const codeTrigger = /\b(my code|my files|my repo|my project|review my code|look at my code|inspect my code|review code)\b/i;
    if (session.agentMode && codeTrigger.test(prompt)) {
      const proceed = (await promptUser('It looks like you want a code review. Scan workspace and attach files? (Y/n): ')).trim().toLowerCase();
      if (proceed === '' || proceed === 'y' || proceed === 'yes') {
        try {
          const files = await listWorkspaceCodeFiles('.');
          if (!files.length) console.log(`${colors.dim}No code files found in workspace.${colors.reset}`);
          else {
            const selected = await chooseFilesFromList(files);
            if (selected && selected.length) {
                // Summarization-first flow: build small snippets and ask the model to produce a concise digest
                const doSumm = (await promptUser(`Create a concise digest of ${selected.length} files first (recommended to save usage)? (Y/n): `)).trim().toLowerCase();
                if (doSumm === '' || doSumm === 'y' || doSumm === 'yes') {
                  const SNIPPET_LIMIT = parseInt(process.env.CLAUDEB_SNIPPET_LIMIT || '1024', 10);
                  const snippetParts = [];
                  for (const f of selected) {
                    try {
                      const snip = await codeTools.readFileSnippet(f, SNIPPET_LIMIT);
                      snippetParts.push(`---\nFILE: ${f}\n---\n${snip}`);
                    } catch (e) {
                      snippetParts.push(`---\nFILE: ${f}\n---\n[Could not read snippet: ${e.message || e}]`);
                    }
                  }
                  const summaryPrompt = `You are a codebase summarizer. For each file produce a 1-2 sentence summary of purpose, list key functions/classes, and highlight likely issues or TODOs. Keep it concise and developer-focused. Use the provided file snippets (which may be truncated).\n\n${snippetParts.join('\n\n')}`;
                  const summaryModel = process.env.PUTER_SUMMARY_MODEL || process.env.PUTER_FALLBACK_MODEL || process.env.PUTER_FALLBACK || 'openrouter/free';
                  const stopSumm = startSpinner('Generating file digest...');
                  let summaryResponse = null;
                  try {
                    summaryResponse = await generateClaude(summaryPrompt, summaryModel);
                  } catch (err) {
                    stopSumm();
                    console.log(`${colors.yellow}Summarization failed: ${err.message || err}${colors.reset}`);
                  }
                  stopSumm();
                  const digest = extractContent(summaryResponse) || '(no summary produced)';
                  console.log(`${colors.bright}File digest:${colors.reset}\n${digest}\n`);
                  const useDigest = (await promptUser('Send this digest instead of attaching full files? (Y/n): ')).trim().toLowerCase();
                  if (useDigest === '' || useDigest === 'y' || useDigest === 'yes') {
                    promptToSend = `Attached workspace file digest:\n\n${digest}\n\nUser message:\n${prompt}`;
                  } else {
                    const fileContents = await fetchFilesContent(selected);
                    const attachments = fileContents.map(f => {
                      const note = f.truncated ? ' (TRUNCATED)' : '';
                      return `---\nFILE: ${f.path}${note}\n---\n${f.content}`;
                    }).join('\n\n');
                    promptToSend = `Attached workspace files:\n\n${attachments}\n\nUser message:\n${prompt}`;
                  }
                } else {
                  const fileContents = await fetchFilesContent(selected);
                  const attachments = fileContents.map(f => {
                    const note = f.truncated ? ' (TRUNCATED)' : '';
                    return `---\nFILE: ${f.path}${note}\n---\n${f.content}`;
                  }).join('\n\n');
                  promptToSend = `Attached workspace files:\n\n${attachments}\n\nUser message:\n${prompt}`;
                }
              }
          }
        } catch (err) {
          console.log(`${colors.yellow}Could not list workspace files: ${err.message}${colors.reset}`);
        }
      }
    }

    const stop = startSpinner(`Generating with ${session.model}...`);
    const effort = session.effort || 'high';
    const finalPrompt = (devMode ? `Developer Mode - answer directly and succinctly, with minimal filler. Always follow safety guidelines.\n\n` : '') + `Effort: ${effort}\n\n${promptToSend}`;
    const response = await generateClaude(finalPrompt, session.model);
    stop();
    const content = extractContent(response);
    session.history.push({ prompt, response: content, ts: Date.now() });
    if (session.name) {
      try { await sessionManager.saveSession(session.name, session); } catch (err) { }
    }
    console.log(`${colors.green}${colors.bright}Result:${colors.reset}\n`);
    console.log(content + '\n');
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    console.log(`${colors.red}${colors.bright}Error:${colors.reset} ${msg}\n`);
    if (/no usage left|usage limit|quota/i.test(msg)) {
      console.log(`${colors.yellow}Suggestion: the request exceeded your model usage or quota. Try reducing attached files (use /effort low, or select fewer files), or check your PUTER account usage.${colors.reset}\n`);
    }
  }
}

async function handleCommand(cmd, args) {
  switch (cmd) {
    case 'help':
      printHelpExtended();
      break;
    case 'model':
      if (!args) await selectModelInteractive();
      else {
        const asNum = parseInt(args, 10);
        const keys = Object.keys(CLAUDE_MODELS);
        if (!isNaN(asNum) && asNum >= 1 && asNum <= keys.length) session.model = keys[asNum - 1];
        else if (CLAUDE_MODELS[args]) session.model = args;
        else {
          // Accept arbitrary model identifier (e.g. openrouter/free, meta-llama/llama-3.2-3b-instruct:free)
          session.model = args;
          console.log(`${colors.dim}Using custom model key: ${args}${colors.reset}`);
        }
      }
      // if agentMode chosen, then enable agent tools by setting CLAUDEB_AGENT_URL
      if (session.agentMode && !process.env.CLAUDEB_AGENT_URL) {
        process.env.CLAUDEB_AGENT_URL = 'http://127.0.0.1:4823';
      }
      printHeader();
      break;
    case 'save': {
      const name = args || (await promptUser('Save session as: ')).trim();
      if (!name) { console.log(`${colors.yellow}Aborted.${colors.reset}`); break; }
      try { await sessionManager.saveSession(name, session); session.name = name; console.log(`${colors.green}Saved session '${name}'.${colors.reset}`); } catch (err) { console.log(`${colors.red}Error saving:${colors.reset} ${err.message}`); }
      break;
    }
    case 'save-last': {
      const filename = args || (await promptUser('Filename to save last result as: ')).trim();
      if (!filename) { console.log(`${colors.yellow}Aborted.${colors.reset}`); break; }
      const last = session.history && session.history.length ? session.history[session.history.length - 1] : null;
      if (!last || !last.response) { console.log(`${colors.yellow}No recent generation to save.${colors.reset}`); break; }
      await saveContentToFile(last.response, filename);
      break;
    }
    case 'write': {
      const pathArg = args || '';
      await writeFileInteractive(pathArg);
      break;
    }
    // Coding tools
    case 'format': {
      if (!args) { console.log(`${colors.yellow}Usage: /format <path/to/file>${colors.reset}`); break; }
      try {
        const file = args.trim(); const code = await codeTools.readFileContent(file); const stop = startSpinner('Formatting...'); const result = await codeTools.formatCode({ code, filePath: file, modelKey: session.model }); stop(); console.log(`${colors.green}Formatted output:${colors.reset}\n`); console.log(result + '\n'); const save = (await promptUser('Save changes to file? (y/N): ')).trim().toLowerCase(); if (save==='y' || save==='yes') { await codeTools.writeFileContent(file, result); console.log(`${colors.green}Saved.${colors.reset}`); }
      }
      catch(err) { console.log(`${colors.red}Error:${colors.reset} ${err.message || err}`); }
      break;
    }
    case 'explain': {
      if (!args) { console.log(`${colors.yellow}Usage: /explain <path/to/file|history-index>${colors.reset}`); break; }
      try {
        let code = '';
        if (/^\d+$/.test(args)) {
          const n = parseInt(args, 10);
          const entry = session.history[n-1];
          if (!entry) { console.log(`${colors.yellow}No history entry.${colors.reset}`); break; }
          code = entry.prompt;
        } else { code = await codeTools.readFileContent(args.trim()); }
        const stop = startSpinner('Explaining...'); const out = await codeTools.explainCode({ code, filePath: args.trim(), modelKey: session.model }); stop(); console.log(`${colors.green}Explanation:${colors.reset}\n${out}\n`);
      } catch(err) { console.log(`${colors.red}Error:${colors.reset} ${err.message || err}`); }
      break;
    }
    case 'refactor': {
      if (!args) { console.log(`${colors.yellow}Usage: /refactor <path/to/file|history-index>${colors.reset}`); break; }
      try {
        let code = ''; let filePath = '';
        if (/^\d+$/.test(args)) { const n = parseInt(args, 10); const entry = session.history[n-1]; if (!entry) { console.log(`${colors.yellow}No history entry.${colors.reset}`); break; } code = entry.prompt; } else { filePath = args.trim(); code = await codeTools.readFileContent(filePath); }
        const stop = startSpinner('Refactoring...'); const out = await codeTools.refactorCode({ code, filePath, modelKey: session.model }); stop(); console.log(`${colors.green}Refactored code:${colors.reset}\n${out}\n`);
        if (filePath) { const save = (await promptUser('Write refactored code back to file? (y/N): ')).trim().toLowerCase(); if (save==='y' || save==='yes') { await codeTools.writeFileContent(filePath, out); console.log(`${colors.green}Saved.${colors.reset}`); } }
      } catch(err) { console.log(`${colors.red}Error:${colors.reset} ${err.message || err}`); }
      break;
    }
    case 'tests': {
      if (!args) { console.log(`${colors.yellow}Usage: /tests <path/to/file|history-index>${colors.reset}`); break; }
      try {
        let code = ''; let filePath = '';
        if (/^\d+$/.test(args)) { const n = parseInt(args, 10); const entry = session.history[n-1]; if (!entry) { console.log(`${colors.yellow}No history entry.${colors.reset}`); break; } code = entry.prompt; } else { filePath = args.trim(); code = await codeTools.readFileContent(filePath); }
        const stop = startSpinner('Generating tests...'); const out = await codeTools.generateTests({ code, filePath, modelKey: session.model }); stop(); console.log(`${colors.green}Generated tests:${colors.reset}\n${out}\n`);
        if (filePath) { const suggested = filePath.replace(/\.(js|ts|py)$/, '.test.$1'); const save = (await promptUser(`Save test file to ${suggested}? (y/N): `)).trim().toLowerCase(); if (save==='y'||save==='yes') { await codeTools.writeFileContent(suggested, out); console.log(`${colors.green}Saved ${suggested}.${colors.reset}`); } }
      } catch(err) { console.log(`${colors.red}Error:${colors.reset} ${err.message || err}`); }
      break;
    }
    case 'resume': {
      const name = args || (await promptUser('Resume session name: ')).trim();
      if (!name) { console.log(`${colors.yellow}Aborted.${colors.reset}`); break; }
      try { const data = await sessionManager.loadSession(name); session = data; session.name = name; console.log(`${colors.green}Resumed session '${name}'. Model: ${session.model}${colors.reset}`); printHeader(); } catch (err) { console.log(`${colors.red}Could not load session:${colors.reset} ${err.message}`); }
      break;
    }
    case 'list': {
      const names = await sessionManager.listSessions();
      if (!names.length) console.log(`${colors.dim}No saved sessions found.${colors.reset}`); else names.forEach(n => console.log(`- ${n}`));
      break;
    }
    case 'multiline': {
      const a = (args || '').toLowerCase();
      if (!a) multilineMode = !multilineMode;
      else multilineMode = (a === 'on' || a === 'true');
      console.log(`${colors.green}Multiline mode: ${multilineMode ? 'ON' : 'OFF'}${colors.reset}`);
      break;
    }
    case 'effort': {
      const a = (args || '').toLowerCase();
      if (!a) { console.log(`${colors.green}Current effort: ${session.effort}${colors.reset}`); break; }
      if (!['low','medium','high'].includes(a)) { console.log(`${colors.yellow}Usage: /effort <low|medium|high>${colors.reset}`); break; }
      session.effort = a;
      console.log(`${colors.green}Effort set to: ${session.effort}${colors.reset}`);
      break;
    }
    case 'devmode': {
      const a = (args || '').toLowerCase();
      if (!a) devMode = !devMode;
      else devMode = (a === 'on' || a === 'true');
      console.log(`${colors.green}Developer mode: ${devMode ? 'ON' : 'OFF'}${colors.reset}`);
      break;
    }
    case 'run': {
      const cmdline = args || (await promptUser('Command to run: ')).trim();
      if (!cmdline) { console.log(`${colors.yellow}Aborted.${colors.reset}`); break; }
      const dangerous = /\brm\b|\bdd\b|\bmkfs\b|\bsudo\b|:\>|\b:>/i.test(cmdline);
      if (dangerous) {
        const ok = (await promptUser(`The command looks dangerous: '${cmdline}'. Proceed? (y/N): `)).trim().toLowerCase();
        if (ok !== 'y' && ok !== 'yes') { console.log(`${colors.yellow}Cancelled.${colors.reset}`); break; }
      }
      console.log(`${colors.dim}Running: ${cmdline}${colors.reset}`);
      exec(cmdline, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        if (error) console.log(`${colors.red}Command failed: ${error.message}${colors.reset}`);
      });
      break;
    }
    case 'npm-test': {
      console.log(`${colors.dim}Running npm test...${colors.reset}`);
      exec('npm test', { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        if (err) console.log(`${colors.red}npm test failed: ${err.message}${colors.reset}`);
      });
      break;
    }
    case 'git-status': {
      exec('git status --short', { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) { console.log(`${colors.red}git status failed:${colors.reset} ${err.message}`); return; }
        console.log(stdout || `${colors.dim}clean${colors.reset}`);
      });
      break;
    }
    case 'nofilter': {
      console.log(`${colors.yellow}I can't remove safety filters or provide a 'no filter' mode. I can enable a 'developer mode' that makes responses more direct while still following safety rules.${colors.reset}`);
      break;
    }
    case 'history': {
      if (!session.history.length) { console.log(`${colors.dim}No history yet.${colors.reset}`); break; }
      session.history.slice().reverse().forEach((h, i) => {
        const idx = session.history.length - i;
        console.log(`${colors.yellow}[${idx}]${colors.reset} ${new Date(h.ts).toLocaleString()} - ${h.prompt.split('\n')[0].slice(0,80)}`);
      });
      break;
    }
    case 'show': {
      const n = parseInt(args, 10);
      if (isNaN(n) || n < 1 || n > session.history.length) { console.log(`${colors.yellow}Invalid entry number.${colors.reset}`); break; }
      const entry = session.history[n - 1];
      console.log(`${colors.bright}Prompt:${colors.reset}\n${entry.prompt}\n`);
      console.log(`${colors.bright}Response:${colors.reset}\n${entry.response}\n`);
      break;
    }
    case 'exit':
      return false;
    default:
      console.log(`${colors.yellow}Unknown command: ${cmd}. Type /help${colors.reset}`);
  }
  return true;
}

async function main() {
  printHeader();
  console.log(`${colors.green}Welcome to Claudeb (enhanced).${colors.reset}`);
  console.log(`${colors.dim}Enter text to generate or a command starting with '/' (e.g. /help).${colors.reset}\n`);
  try {
    // Ask whether user wants Chatbot or Agent mode before model selection
    let mode = '';
    if (BATCH_MODE) {
      mode = (BATCH_LINES.shift() || '').trim().toLowerCase();
    } else {
      mode = (await promptUser('Choose mode - Chatbot or Agent? (c/a, default c): ')).trim().toLowerCase();
    }
    session.agentMode = (mode === 'a' || mode === 'agent');
    if (session.agentMode) {
      try { await agentStarter.ensureAgentRunning(); } catch (e) { console.log(`${colors.yellow}Could not start local agent: ${e.message}${colors.reset}`); }
    }
    await selectModelInteractive();
    let running = true;
    while (running) {
      const input = await getInput();
      if (!input) break;
      if (input.type === 'empty') continue;
      if (input.type === 'command') {
        const ok = await handleCommand(input.command, input.args);
        if (!ok) break;
        continue;
      }
      if (input.type === 'prompt') {
        await generate(input.text);
      }
    }
    console.log(`${colors.green}Goodbye.${colors.reset}`);
    rl.close();
  } catch (err) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, err.message || err);
    rl.close();
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log(`\n\n${colors.yellow}Session interrupted.${colors.reset}`);
  if (session.name) {
    try { await sessionManager.saveSession(session.name, session); console.log(`${colors.green}Session '${session.name}' saved.${colors.reset}`); } catch (err) { }
  }
  try { agentStarter.stopAgent(); } catch (e) { }
  rl.close();
  process.exit(0);
});

main().catch((err) => {
  const out = err && err.stack ? err.stack : String(err);
  console.error(`${colors.red}Fatal error:${colors.reset}\n${out}`);
  try { if (rl && !rl.closed) rl.close(); } catch (e) { }
  process.exit(1);
});
