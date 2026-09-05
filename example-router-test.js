const { generateOpenRouter } = require('./puter-router');
console.log('Testing OpenRouter via Puter...');
(async function(){
  try {
    const resp = await generateOpenRouter('Write a short two-line haiku about developer tools.', 'openrouter/free');
    console.log('\n=== Response ===\n');
    console.log(resp.message?.content?.[0]?.text || resp);
    console.log('\n=== End ===\n');
  } catch (err) {
    console.error('OpenRouter test failed:', err.message || err);
    process.exit(1);
  }
})();
