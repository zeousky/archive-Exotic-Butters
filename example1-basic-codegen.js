/**
 * Example 1: Basic Code Generation
 * Shows how to generate code using the Codex API for simple tasks
 */

const { getPuterInstance } = require('./puter-auth-helper');

async function basicCodeGeneration() {
  try {
    console.log('Initializing Puter...');
    const puter = getPuterInstance();

    console.log('Generating binary search function...\n');

    const response = await puter.ai.chat(
      'Write a JavaScript function that implements binary search on a sorted array',
      { model: 'openai/gpt-5.3-codex' }
    );

    console.log('Generated Code:\n');
    console.log(response.message?.content || response);
    console.log('\nCode generation complete!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
basicCodeGeneration();
