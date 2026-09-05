/**
 * Example: Streaming Claude responses
 */

const { streamChat } = require('./puter-chat');

async function run() {
  try {
    console.log('Streaming Claude response...\n');
    const prompt = 'Write a detailed essay on the impact of artificial intelligence on society';
    const stream = await streamChat(prompt, 'sonnet-4-6');
    for await (const part of stream) {
      // parts may include text property
      process.stdout.write(part?.text || part?.message?.content || '');
    }
    console.log('\n\nStream complete');
  } catch (err) {
    console.error('Error during stream:', err.message || err);
  }
}

run();
