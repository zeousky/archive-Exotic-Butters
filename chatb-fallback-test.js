#!/usr/bin/env node
const { generateClaude } = require('./puter-chat');

async function main() {
  const prompt = process.argv.slice(2).join(' ') || 'Say hello';
  try {
    const res = await generateClaude(prompt, process.env.TEST_MODEL || 'claude-sonnet-4-6');
    console.log('Response:', res);
  } catch (e) {
    console.error('Failed:', e.message || e);
    process.exit(1);
  }
}

main();
