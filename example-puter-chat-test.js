/**
 * Quick non-interactive test for Puter Claude integration
 * Usage: node example-puter-chat-test.js
 */

const { generateClaude } = require('./puter-chat');

async function test() {
  try {
    console.log('Testing Claude API (puter)...');
    const resp = await generateClaude('Write a two-line haiku about code and coffee.', 'claude-sonnet-4-6');
    console.log('\n=== Response ===\n');
    console.log(resp.message?.content?.[0]?.text || JSON.stringify(resp, null, 2));
    console.log('\n=== End ===\n');
  } catch (err) {
    console.error('Test failed:', err.message || err);
  }
}

test();
