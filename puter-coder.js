/**
 * Puter Codex API Utility
 * Provides functions to interact with the Codex API through Puter.js
 * No API keys or authentication required - users pay for their own usage
 */

const { getPuterInstance } = require('./puter-auth-helper');

let puter = null;

/**
 * Initialize Puter with authentication
 * @param {Object} puterInstance - Pre-initialized puter instance (optional)
 * @returns {Object} Initialized puter instance
 */
function initPuter(puterInstance = null) {
  if (puter) return puter;

  if (puterInstance) {
    puter = puterInstance;
    return puter;
  }

  puter = getPuterInstance();
  return puter;
}

/**
 * Available Codex models
 */
const CODEX_MODELS = {
  'gpt-5.3': 'openai/gpt-5.3-codex',
  'gpt-5.2': 'openai/gpt-5.2-codex',
  'gpt-5.1': 'openai/gpt-5.1-codex',
  'gpt-5.1-mini': 'openai/gpt-5.1-codex-mini',
  'gpt-5.1-max': 'openai/gpt-5.1-codex-max',
  'gpt-5': 'openai/gpt-5-codex',
};

/**
 * Generate code using Codex API
 * @param {string} prompt - The prompt for code generation
 * @param {string} model - Model type (default: 'gpt-5.1')
 * @returns {Promise<string>} Generated code
 */
async function generateCode(prompt, model = 'gpt-5.1') {
  try {
    const puterInstance = initPuter();
    const modelName = CODEX_MODELS[model] || CODEX_MODELS['gpt-5.1'];

    const response = await puterInstance.ai.chat(prompt, {
      model: modelName,
    });

    return response;
  } catch (error) {
    console.error('Codex API Error:', error);
    throw error;
  }
}

/**
 * Generate code with maximum performance (for demanding tasks)
 * @param {string} prompt - The prompt for code generation
 * @returns {Promise<string>} Generated code
 */
async function generateCodeMax(prompt) {
  return generateCode(prompt, 'gpt-5.1-max');
}

/**
 * Generate code efficiently (for simpler tasks)
 * @param {string} prompt - The prompt for code generation
 * @returns {Promise<string>} Generated code
 */
async function generateCodeMini(prompt) {
  return generateCode(prompt, 'gpt-5.1-mini');
}

/**
 * Generate code with latest model
 * @param {string} prompt - The prompt for code generation
 * @returns {Promise<string>} Generated code
 */
async function generateCodeLatest(prompt) {
  return generateCode(prompt, 'gpt-5.3');
}

/**
 * Chat/instruction following with Codex
 * @param {string} message - Message or instruction
 * @param {string} model - Model type
 * @returns {Promise<string>} Response from Codex
 */
async function askCodex(message, model = 'gpt-5.1') {
  try {
    const puterInstance = initPuter();
    const modelName = CODEX_MODELS[model] || CODEX_MODELS['gpt-5.1'];

    const response = await puterInstance.ai.chat(message, {
      model: modelName,
    });

    return response;
  } catch (error) {
    console.error('Codex Chat Error:', error);
    throw error;
  }
}

/**
 * Explain code using Codex
 * @param {string} code - Code to explain
 * @param {string} model - Model type
 * @returns {Promise<string>} Code explanation
 */
async function explainCode(code, model = 'gpt-5.1-mini') {
  const prompt = `Please explain the following code:\n\n${code}`;
  return generateCode(prompt, model);
}

/**
 * Refactor code using Codex
 * @param {string} code - Code to refactor
 * @param {string} instructions - Refactoring instructions
 * @param {string} model - Model type
 * @returns {Promise<string>} Refactored code
 */
async function refactorCode(code, instructions = 'Improve and optimize this code', model = 'gpt-5.1') {
  const prompt = `${instructions}:\n\n${code}`;
  return generateCode(prompt, model);
}

/**
 * Fix bugs in code using Codex
 * @param {string} code - Code with bugs
 * @param {string} bugDescription - Description of the bug
 * @param {string} model - Model type
 * @returns {Promise<string>} Fixed code
 */
async function fixCode(code, bugDescription, model = 'gpt-5.1') {
  const prompt = `Fix this bug in the code. Bug description: ${bugDescription}\n\nCode:\n${code}`;
  return generateCode(prompt, model);
}

/**
 * Generate unit tests for code
 * @param {string} code - Code to generate tests for
 * @param {string} testFramework - Test framework (e.g., 'jest', 'mocha', 'pytest')
 * @param {string} model - Model type
 * @returns {Promise<string>} Generated tests
 */
async function generateTests(code, testFramework = 'jest', model = 'gpt-5.1') {
  const prompt = `Generate ${testFramework} unit tests for this code:\n\n${code}`;
  return generateCode(prompt, model);
}

/**
 * Get the list of available models
 * @returns {Object} Available models
 */
function getAvailableModels() {
  return CODEX_MODELS;
}

module.exports = {
  initPuter,
  generateCode,
  generateCodeMax,
  generateCodeMini,
  generateCodeLatest,
  askCodex,
  explainCode,
  refactorCode,
  fixCode,
  generateTests,
  getAvailableModels,
  CODEX_MODELS,
};
