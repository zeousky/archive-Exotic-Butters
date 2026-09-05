/**
 * Advanced Codex Integration Examples
 * Practical examples for integrating Puter Codex into your Discord bot
 */

const { getPuterInstance } = require('./puter-auth-helper');

let puter = null;

/**
 * Initialize Puter with authentication
 * @returns {Object} Initialized puter instance
 */
function initPuter() {
  if (puter) return puter;

  puter = getPuterInstance();
  return puter;
}

/**
 * Example: Code Review Assistant
 * Analyzes code and provides improvement suggestions
 */
async function codeReviewAssistant(userCode) {
  try {
    const puterInstance = initPuter();
    const prompt = `Review this code and suggest improvements for readability, performance, and best practices:\n\n${userCode}`;

    const review = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex',
    });

    return review;
  } catch (error) {
    console.error('Code Review Error:', error);
    throw error;
  }
}

/**
 * Example: Learning Assistant
 * Explains programming concepts using code examples
 */
async function learningAssistant(concept) {
  try {
    const puterInstance = initPuter();
    const prompt = `Explain the concept of "${concept}" in programming with JavaScript code examples. Include:
1. Simple explanation
2. Code example 1 (basic)
3. Code example 2 (advanced)
4. Common mistakes`;

    const explanation = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex-mini',  // Efficient for educational content
    });

    return explanation;
  } catch (error) {
    console.error('Learning Assistant Error:', error);
    throw error;
  }
}

/**
 * Example: Bug Squasher
 * Analyzes error messages and suggests fixes
 */
async function bugSquasher(errorMessage, context) {
  try {
    const puterInstance = initPuter();
    const prompt = `I got this error: "${errorMessage}"

Context: ${context}

What's wrong and how do I fix it? Provide the corrected code.`;

    const solution = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex',
    });

    return solution;
  } catch (error) {
    console.error('Bug Squasher Error:', error);
    throw error;
  }
}

/**
 * Example: Code Converter
 * Convert code between programming languages
 */
async function codeConverter(code, fromLang, toLang) {
  try {
    const puterInstance = initPuter();
    const prompt = `Convert this ${fromLang} code to ${toLang}:\n\n${code}`;

    const converted = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex',
    });

    return converted;
  } catch (error) {
    console.error('Code Converter Error:', error);
    throw error;
  }
}

/**
 * Example: Documentation Generator
 * Generates comments and documentation for code
 */
async function documentationGenerator(code) {
  try {
    const puterInstance = initPuter();
    const prompt = `Generate comprehensive JSDoc comments and documentation for this code:\n\n${code}`;

    const documented = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex-mini',
    });

    return documented;
  } catch (error) {
    console.error('Documentation Generator Error:', error);
    throw error;
  }
}

/**
 * Example: Performance Analyzer
 * Analyzes code for performance bottlenecks
 */
async function performanceAnalyzer(code) {
  try {
    const puterInstance = initPuter();
    const prompt = `Analyze this code for performance issues and optimization opportunities:\n\n${code}

Provide:
1. Identified issues
2. Time complexity analysis
3. Specific optimizations
4. Optimized code example`;

    const analysis = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex-max',  // More powerful for detailed analysis
    });

    return analysis;
  } catch (error) {
    console.error('Performance Analyzer Error:', error);
    throw error;
  }
}

/**
 * Example: Security Auditor
 * Checks code for security vulnerabilities
 */
async function securityAuditor(code) {
  try {
    const puterInstance = initPuter();
    const prompt = `Perform a security audit of this code and identify vulnerabilities:\n\n${code}

Identify:
1. Security vulnerabilities
2. Input validation issues
3. Authentication/authorization problems
4. Recommended fixes`;

    const audit = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex-max',
    });

    return audit;
  } catch (error) {
    console.error('Security Auditor Error:', error);
    throw error;
  }
}

/**
 * Example: Boilerplate Generator
 * Generates boilerplate code for common patterns
 */
async function boilerplateGenerator(pattern, options = '') {
  try {
    const puterInstance = initPuter();
    const prompt = `Generate boilerplate code for a ${pattern} pattern. ${options}

Include:
1. Complete working example
2. Brief explanation
3. Common use cases
4. Tips for customization`;

    const boilerplate = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex',
    });

    return boilerplate;
  } catch (error) {
    console.error('Boilerplate Generator Error:', error);
    throw error;
  }
}

/**
 * Example: Unit Test Generator
 * Generates comprehensive unit tests
 */
async function unitTestGenerator(code, testFramework = 'jest') {
  try {
    const puterInstance = initPuter();
    const prompt = `Generate comprehensive ${testFramework} unit tests for this code:\n\n${code}

Include:
1. Happy path tests
2. Edge case tests
3. Error handling tests
4. Coverage for all functions`;

    const tests = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex',
    });

    return tests;
  } catch (error) {
    console.error('Unit Test Generator Error:', error);
    throw error;
  }
}

/**
 * Example: Architecture Advisor
 * Suggests architecture and design patterns
 */
async function architectureAdvisor(requirements) {
  try {
    const puterInstance = initPuter();
    const prompt = `Suggest an architecture and design patterns for the following requirements:

${requirements}

Provide:
1. Overall architecture suggestion
2. Design patterns to use
3. Technology recommendations
4. Implementation roadmap
5. Code structure example`;

    const architecture = await puterInstance.ai.chat(prompt, {
      model: 'openai/gpt-5.1-codex-max',
    });

    return architecture;
  } catch (error) {
    console.error('Architecture Advisor Error:', error);
    throw error;
  }
}

// Export all functions
module.exports = {
  initPuter,
  codeReviewAssistant,
  learningAssistant,
  bugSquasher,
  codeConverter,
  documentationGenerator,
  performanceAnalyzer,
  securityAuditor,
  boilerplateGenerator,
  unitTestGenerator,
  architectureAdvisor,
};
