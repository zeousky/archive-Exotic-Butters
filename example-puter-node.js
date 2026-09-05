/**
 * Example: Node.js usage of Puter.js (requires PUTER_AUTH_TOKEN)
 *
 * Usage:
 * 1. Create an API token at https://puter.com/app/dev-center
 * 2. Set it in your environment or a .env file as PUTER_AUTH_TOKEN
 *    e.g. export PUTER_AUTH_TOKEN="your_token_here"
 * 3. Run: node example-puter-node.js
 */

const { getPuterInstance } = require('./puter-auth-helper');

async function main() {
  try {
    console.log('Initializing Puter (Node)...');
    const puter = getPuterInstance();

    const resp = await puter.ai.chat(
      'Write a short poem about coding',
      { model: 'claude-sonnet-4-6' }
    );

    console.log('\n=== Response ===\n');
    console.log(resp.message?.content?.[0]?.text || resp);
    console.log('\n=== End ===\n');
  } catch (err) {
    console.error('Error:', err.message || err);
  }
}

main();
