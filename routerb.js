#!/usr/bin/env node

/**
 * Openrouterb - Interactive OpenRouter Interface (Enhanced for coding workflows)
 */

const readline = require('readline');
const path = require('path');
const sessionManager = require('./cli-session');
const codeTools = require('./cli-code-tools');
const { OPENROUTER_MODELS, generateOpenRouter } = require('./puter-router');
const { getPuterInstance } = require('./puter-auth-helper');
const agentStarter = require('./agent-starter');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

const colors = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[34m',
};

let session = { name: null, model: 'openrouter/free', history: [] };
// Behavior toggles
let devMode = false;
let multilineMode = false;
const { exec } = require('child_process');

function printHeader() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║       OPENROUTERB - OPENROUTER UI      ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);
  console.log(`${colors.dim}Type :help for commands. Current model: ${colors.bright}${session.model}${colors.reset}${colors.dim}${session.name ? '  •  Session: ' + session.name : ''}${colors.reset}\n`);
}

function printModels() {
  console.log(`${colors.bright}Available Models:${colors.reset}\n`);
  Object.keys(OPENROUTER_MODELS).forEach((k, i) => console.log(`${colors.green}[${i+1}]${colors.reset} ${colors.bright}${k}${colors.reset}`));
  console.log();
}

function printHelp() {
  console.log(`${colors.bright}Commands:${colors.reset}`);
  console.log(`${colors.yellow}:help${colors.reset}        - Show this help`);
  console.log(`${colors.yellow}:model${colors.reset}       - Change or show current model`);
  console.log(`${colors.yellow}:save <name>${colors.reset} - Save current session`);
  console.log(`${colors.yellow}:resume <name>${colors.reset} - Resume saved session`);
  console.log(`${colors.yellow}:list${colors.reset}        - List saved sessions`);
  console.log(`${colors.yellow}:format <file>${colors.reset} - Format code file using model`);
  console.log(`${colors.yellow}:explain <file|n>${colors.reset} - Explain file or history entry`);
  console.log(`${colors.yellow}:refactor <file|n>${colors.reset} - Refactor file or history entry`);
  console.log(`${colors.yellow}:tests <file|n>${colors.reset} - Generate unit tests for file or history entry`);
  console.log(`${colors.yellow}:history${colors.reset}     - Show session history`);
  console.log(`${colors.yellow}:show <n>${colors.reset}   - Show history entry`);
  console.log(`${colors.yellow}:multiline on|off${colors.reset} - Toggle multi-line prompt mode (default: off - single Enter sends)`);
  console.log(`${colors.yellow}:devmode on|off${colors.reset}  - Toggle developer mode (more direct responses, still safe)`);
  console.log(`${colors.yellow}:run <cmd>${colors.reset}      - Run a shell command (you will be asked to confirm if potentially dangerous)`);
  console.log(`${colors.yellow}:npm-test${colors.reset}        - Run 'npm test' in workspace`);
  console.log(`${colors.yellow}:git-status${colors.reset}     - Run 'git status --short'`);
  console.log(`${colors.yellow}:nofilter${colors.reset}       - Explain why removing safety filters is not allowed`);
  console.log(`${colors.yellow}:exit${colors.reset}        - Exit the CLI\n`);
}

function promptUser(question) { return new Promise((resolve) => rl.question(question, (a) => resolve(a))); }

function startSpinner(message = 'Processing') {
  const spinner = ['|','/','-','\\']; let i = 0; process.stdout.write(`${message} `); const id = setInterval(()=>{ process.stdout.write('\b' + spinner[i%spinner.length]); i++; }, 80); return ()=>{ clearInterval(id); process.stdout.write('\b'); process.stdout.write(' \n'); };
}

async function selectModelInteractive() {
  console.log(`${colors.bright}Select a model:${colors.reset}`);
  console.log(`${colors.dim}(Enter number, model key, or press Enter for current)${colors.reset}\n`);
  printModels();
  const input = await promptUser(`${colors.cyan}? Model ${colors.reset}`);
  const keys = Object.keys(OPENROUTER_MODELS);
  const choice = input.trim();
  if (!choice) return session.model;
  const asNum = parseInt(choice,10);
  if (!isNaN(asNum) && asNum>=1 && asNum<=keys.length) { session.model = keys[asNum-1]; return session.model; }
  if (OPENROUTER_MODELS[choice]) { session.model = choice; return session.model; }
  console.log(`${colors.yellow}Invalid choice; keeping ${session.model}${colors.reset}`);
  return session.model;
}

async function getInput() {
  const first = await promptUser(`${colors.cyan}> ${colors.reset}`);
  if (first === null) return null;
  const t = first.trim();
  if (t === '') return { type: 'empty' };
  if (t.startsWith(':')) { const [cmd, ...rest] = t.slice(1).split(' '); const args = rest.join(' ').trim(); return { type: 'command', command: cmd.toLowerCase(), args }; }
  if (t.toLowerCase() === 'exit') return { type: 'command', command: 'exit', args: '' };
  if (!multilineMode) return { type: 'prompt', text: first };
  const lines = [first]; while (true) { const line = await promptUser(''); if (line === '') break; lines.push(line); }
  return { type: 'prompt', text: lines.join('\n') };
}

function extractContent(response) {
  if (!response) return '';
  if (typeof response === 'string') return response;
  if (response.message && response.message.content) { if (Array.isArray(response.message.content)) return response.message.content.map(c=>c.text||c).join('\n'); return response.message.content; }
  if (response.toString) return response.toString(); return JSON.stringify(response);
}

async function generate(prompt) {
  try {
    const stop = startSpinner(`Generating with ${session.model}...`);
    const finalPrompt = devMode ? `Developer Mode - answer directly and succinctly, with minimal filler. Always follow safety guidelines.\n\n${prompt}` : prompt;
    const resp = await generateOpenRouter(finalPrompt, session.model);
    stop();
    const content = extractContent(resp);
    session.history.push({ prompt, response: content, ts: Date.now() });
    if (session.name) { try { await sessionManager.saveSession(session.name, session); } catch(e){} }
    console.log(`${colors.green}${colors.bright}Result:${colors.reset}\n`);
    console.log(content + '\n');
  } catch (err) { console.log(`${colors.red}Error:${colors.reset} ${err.message || err}\n`); }
}

async function handleCommand(cmd,args) {
  switch(cmd) {
    case 'help': printHelp(); break;
    case 'model': if (!args) await selectModelInteractive(); else { const asNum = parseInt(args,10); const keys=Object.keys(OPENROUTER_MODELS); if (!isNaN(asNum)&&asNum>=1&&asNum<=keys.length) session.model=keys[asNum-1]; else if (OPENROUTER_MODELS[args]) session.model=args; else console.log(`${colors.yellow}Unknown model key.${colors.reset}`); } printHeader(); break;
    case 'save': { const name = args || (await promptUser('Save session as: ')).trim(); if (!name) { console.log(`${colors.yellow}Aborted.${colors.reset}`); break; } try { await sessionManager.saveSession(name, session); session.name = name; console.log(`${colors.green}Saved session '${name}'.${colors.reset}`);} catch (err) { console.log(`${colors.red}Error saving:${colors.reset} ${err.message}`);} break; }
    case 'resume': { const name = args || (await promptUser('Resume session name: ')).trim(); if (!name) { console.log(`${colors.yellow}Aborted.${colors.reset}`); break; } try { const data = await sessionManager.loadSession(name); session = data; session.name = name; console.log(`${colors.green}Resumed session '${name}'. Model: ${session.model}${colors.reset}`); printHeader(); } catch (err) { console.log(`${colors.red}Could not load session:${colors.reset} ${err.message}`); } break; }
    case 'list': { const names = await sessionManager.listSessions(); if (!names.length) console.log(`${colors.dim}No saved sessions found.${colors.reset}`); else names.forEach(n=>console.log(`- ${n}`)); break; }
    case 'multiline': { const a = (args || '').toLowerCase(); if (!a) multilineMode = !multilineMode; else multilineMode = (a === 'on' || a === 'true'); console.log(`${colors.green}Multiline mode: ${multilineMode ? 'ON' : 'OFF'}${colors.reset}`); break; }
    case 'devmode': { const a = (args || '').toLowerCase(); if (!a) devMode = !devMode; else devMode = (a === 'on' || a === 'true'); console.log(`${colors.green}Developer mode: ${devMode ? 'ON' : 'OFF'}${colors.reset}`); break; }
    case 'run': { const cmdline = args || (await promptUser('Command to run: ')).trim(); if (!cmdline) { console.log(`${colors.yellow}Aborted.${colors.reset}`); break; } const dangerous = /\brm\b|\bdd\b|\bmkfs\b|\bsudo\b|:\>|\b:>/i.test(cmdline); if (dangerous) { const ok = (await promptUser(`The command looks dangerous: '${cmdline}'. Proceed? (y/N): `)).trim().toLowerCase(); if (ok !== 'y' && ok !== 'yes') { console.log(`${colors.yellow}Cancelled.${colors.reset}`); break; } } console.log(`${colors.dim}Running: ${cmdline}${colors.reset}`); exec(cmdline, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => { if (stdout) console.log(stdout); if (stderr) console.error(stderr); if (error) console.log(`${colors.red}Command failed: ${error.message}${colors.reset}`); }); break; }
    case 'npm-test': { console.log(`${colors.dim}Running npm test...${colors.reset}`); exec('npm test', { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => { if (stdout) console.log(stdout); if (stderr) console.error(stderr); if (err) console.log(`${colors.red}npm test failed: ${err.message}${colors.reset}`); }); break; }
    case 'git-status': { exec('git status --short', { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => { if (err) { console.log(`${colors.red}git status failed:${colors.reset} ${err.message}`); return; } console.log(stdout || `${colors.dim}clean${colors.reset}`); }); break; }
    case 'nofilter': { console.log(`${colors.yellow}I can't remove safety filters or provide a 'no filter' mode. I can enable a 'developer mode' that makes responses more direct while still following safety rules.${colors.reset}`); break; }
    case 'history': { if (!session.history.length) { console.log(`${colors.dim}No history yet.${colors.reset}`); break; } session.history.slice().reverse().forEach((h,i)=>{ const idx = session.history.length - i; console.log(`${colors.yellow}[${idx}]${colors.reset} ${new Date(h.ts).toLocaleString()} - ${h.prompt.split('\n')[0].slice(0,80)}`); }); break; }
    case 'show': { const n = parseInt(args,10); if (isNaN(n)||n<1 || n>session.history.length) { console.log(`${colors.yellow}Invalid entry number.${colors.reset}`); break; } const entry = session.history[n-1]; console.log(`${colors.bright}Prompt:${colors.reset}\n${entry.prompt}\n`); console.log(`${colors.bright}Response:${colors.reset}\n${entry.response}\n`); break; }
    case 'format': {
      if (!args) { console.log(`${colors.yellow}Usage: :format <path/to/file>${colors.reset}`); break; }
      try {
        const file = args.trim(); const code = await codeTools.readFileContent(file); const stop = startSpinner('Formatting...'); const result = await codeTools.formatCode({ code, filePath: file, modelKey: session.model }); stop(); console.log(`${colors.green}Formatted output:${colors.reset}\n`); console.log(result + '\n'); const save = (await promptUser('Save changes to file? (y/N): ')).trim().toLowerCase(); if (save==='y' || save==='yes') { await codeTools.writeFileContent(file, result); console.log(`${colors.green}Saved.${colors.reset}`); } }
      catch(err) { console.log(`${colors.red}Error:${colors.reset} ${err.message || err}`); }
      break; }
    case 'explain': {
      if (!args) { console.log(`${colors.yellow}Usage: :explain <path/to/file|history-index>${colors.reset}`); break; }
      try {
        let code=''; if (/^\d+$/.test(args)) { const n=parseInt(args,10); const entry=session.history[n-1]; if (!entry) { console.log(`${colors.yellow}No history entry.${colors.reset}`); break; } code = entry.prompt; } else { code = await codeTools.readFileContent(args.trim()); }
        const stop = startSpinner('Explaining...'); const out = await codeTools.explainCode({ code, filePath: args.trim(), modelKey: session.model }); stop(); console.log(`${colors.green}Explanation:${colors.reset}\n${out}\n`);
      } catch(err) { console.log(`${colors.red}Error:${colors.reset} ${err.message || err}`); }
      break; }
    case 'refactor': {
      if (!args) { console.log(`${colors.yellow}Usage: :refactor <path/to/file|history-index>${colors.reset}`); break; }
      try {
        let code=''; let filePath=''; if (/^\d+$/.test(args)) { const n=parseInt(args,10); const entry=session.history[n-1]; if (!entry) { console.log(`${colors.yellow}No history entry.${colors.reset}`); break; } code = entry.prompt; } else { filePath=args.trim(); code = await codeTools.readFileContent(filePath); }
        const stop = startSpinner('Refactoring...'); const out = await codeTools.refactorCode({ code, filePath, modelKey: session.model }); stop(); console.log(`${colors.green}Refactored code:${colors.reset}\n${out}\n`);
        if (filePath) { const save = (await promptUser('Write refactored code back to file? (y/N): ')).trim().toLowerCase(); if (save==='y' || save==='yes') { await codeTools.writeFileContent(filePath, out); console.log(`${colors.green}Saved.${colors.reset}`); } }
      } catch(err) { console.log(`${colors.red}Error:${colors.reset} ${err.message || err}`); }
      break; }
    case 'tests': {
      if (!args) { console.log(`${colors.yellow}Usage: :tests <path/to/file|history-index>${colors.reset}`); break; }
      try {
        let code=''; let filePath=''; if (/^\d+$/.test(args)) { const n=parseInt(args,10); const entry=session.history[n-1]; if (!entry) { console.log(`${colors.yellow}No history entry.${colors.reset}`); break; } code = entry.prompt; } else { filePath=args.trim(); code = await codeTools.readFileContent(filePath); }
        const stop = startSpinner('Generating tests...'); const out = await codeTools.generateTests({ code, filePath, modelKey: session.model }); stop(); console.log(`${colors.green}Generated tests:${colors.reset}\n${out}\n`);
        if (filePath) { const suggested = filePath.replace(/\.(js|ts|py)$/, '.test.$1'); const save = (await promptUser(`Save test file to ${suggested}? (y/N): `)).trim().toLowerCase(); if (save==='y'||save==='yes') { await codeTools.writeFileContent(suggested, out); console.log(`${colors.green}Saved ${suggested}.${colors.reset}`); } }
      } catch(err) { console.log(`${colors.red}Error:${colors.reset} ${err.message || err}`); }
      break; }
    case 'exit': return false;
    default: console.log(`${colors.yellow}Unknown command: ${cmd}. Type :help${colors.reset}`);
  }
  return true;
}

async function main() {
  printHeader(); console.log(`${colors.green}Welcome to Openrouterb (coding-focused).${colors.reset}`); console.log(`${colors.dim}Enter text to generate or use commands starting with ':' (e.g. :help).${colors.reset}\n`);
  try {
    try {
      await agentStarter.ensureAgentRunning();
    } catch (e) {
      console.log(`${colors.yellow}Could not start local agent: ${e.message}${colors.reset}`);
    }
    await selectModelInteractive();
    let running = true;
    while (running) {
      const input = await getInput();
      if (!input) break; if (input.type === 'empty') continue; if (input.type === 'command') { const ok = await handleCommand(input.command, input.args); if (!ok) break; continue; }
      if (input.type === 'prompt') await generate(input.text);
    }
    console.log(`${colors.green}Goodbye.${colors.reset}`); rl.close();
  } catch (err) { console.error(`${colors.red}Fatal error:${colors.reset}`, err.message || err); rl.close(); process.exit(1); }
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

main().catch((err)=>{ console.error(`${colors.red}Fatal error:${colors.reset}`, err.message || err); rl.close(); process.exit(1); });
