/**
 * Example: Basic Claude text generation
 */

const { chat } = require('./puter-chat');

async function run() {
  try {
    console.log('Initializing Puter Claude example...');
    const prompt = 'Explain quantum computing in simple terms';
    const response = await chat(prompt, 'sonnet-4-6');
    // Most Puter responses include message.content[0].text
    const text = response.message?.content?.[0]?.text || response.message?.content || response;
    console.log('\n=== Response ===\n');
    console.log(text);
  } catch (err) {
    console.error('Error:', err.message || err);
  }
}

run();
