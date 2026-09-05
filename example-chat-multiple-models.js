/**
 * Example: Use multiple Claude models
 */

const { chat, getAvailableModels } = require('./puter-chat');

async function run() {
  try {
    console.log('Available models:', getAvailableModels());
    const prompt = 'Write a short poem about coding';
    const resp1 = await chat(prompt, 'haiku-4-5');
    const text1 = resp1.message?.content?.[0]?.text || resp1;
    console.log('\n--- Haiku 4.5 ---\n', text1);

    const resp2 = await chat(prompt, 'opus-4-8');
    const text2 = resp2.message?.content?.[0]?.text || resp2;
    console.log('\n--- Opus 4.8 ---\n', text2);
  } catch (err) {
    console.error('Error:', err.message || err);
  }
}

run();
