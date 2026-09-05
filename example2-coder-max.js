/**
 * Example 2: Maximum Performance with Codex Max
 * Shows how to use the most powerful Codex model for demanding coding tasks
 */

const { getPuterInstance } = require('./puter-auth-helper');

async function codexMaxPerformance() {
  try {
    console.log('Initializing Puter...');
    const puter = getPuterInstance();

    console.log('Using Codex Max for a complex task...\n');

    const response = await puter.ai.chat(
      'Create a complete REST API handler in Node.js/Express that includes error handling, validation, authentication middleware, and database connection pooling',
      { model: 'openai/gpt-5.1-codex-max' }
    );

    console.log('Generated Code:\n');
    console.log(response.message?.content || response);
    console.log('\nComplex code generation complete!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
codexMaxPerformance();
