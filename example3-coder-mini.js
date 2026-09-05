/**
 * Example 3: Efficient Code Generation with Codex Mini
 * Shows how to use the faster, more efficient model for simpler tasks
 */

const { getPuterInstance } = require('./puter-auth-helper');

async function codexMiniEfficient() {
  try {
    console.log('Initializing Puter...');
    const puter = getPuterInstance();

    console.log('Using Codex Mini for quick tasks...\n');

    const response = await puter.ai.chat(
      'Write a JavaScript function that formats a date string as MM/DD/YYYY',
      { model: 'openai/gpt-5.1-codex-mini' }
    );

    console.log('Generated Code:\n');
    console.log(response.message?.content || response);
    console.log('\nQuick code generation complete!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
codexMiniEfficient();
