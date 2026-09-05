/**
 * Puter Authentication Helper
 * Handles authentication for Puter.js in Node.js environments
 *
 * To use this:
 * 1. Sign up at https://puter.com
 * 2. Go to https://puter.com/app/dev-center
 * 3. Create an API token
 * 4. Save it to a .env file as: PUTER_AUTH_TOKEN=your_token_here
 */

// Load environment from current working directory first (local runs).
require('dotenv').config();
// If token still not present, try loading .env relative to this module (repo root)
const path = require('path');
const fs = require('fs');
if (!process.env.PUTER_AUTH_TOKEN) {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
    }
  } catch (e) {
    // ignore
  }
}
const { init } = require('@heyputer/puter.js/src/init.cjs');

// Allow overriding the Puter API origin for self-hosted instances
if (process.env.PUTER_API_ORIGIN) {
  try {
    globalThis.PUTER_API_ORIGIN = process.env.PUTER_API_ORIGIN;
    // PUTER_ORIGIN is used by puter for certain redirects; default to same origin if not set
    globalThis.PUTER_ORIGIN = process.env.PUTER_ORIGIN || process.env.PUTER_API_ORIGIN;
  } catch (e) {
    // ignore in non-global contexts
  }
}

/**
 * Get authenticated Puter instance
 * @returns {Object} Initialized puter instance
 */
function getPuterInstance() {
  const authToken = process.env.PUTER_AUTH_TOKEN;

  if (!authToken) {
    // If the user has set PUTER_API_ORIGIN (self-hosted Puter) and explicitly allows anonymous
    // access with PUTER_ALLOW_ANON=1, fall back to initializing Puter without an auth token.
    const allowAnon = (process.env.PUTER_ALLOW_ANON === '1' || process.env.PUTER_ALLOW_ANON === 'true');
    if (!process.env.PUTER_API_ORIGIN || !allowAnon) {
      throw new Error(
        `PUTER_AUTH_TOKEN environment variable not set.

To authenticate with Puter:
1. Go to https://puter.com and sign up (or log in)
2. Visit https://puter.com/app/dev-center
3. Create a new API token
4. Create a .env file in this directory with:
   PUTER_AUTH_TOKEN=your_token_here

Or set the environment variable directly:
   export PUTER_AUTH_TOKEN="your_token_here"
   node your_script.js

If you are running a self-hosted Puter instance, you can point the CLI at it by setting:
   export PUTER_API_ORIGIN="http://localhost:4100"
and optionally allow anonymous access for local development with:
   export PUTER_ALLOW_ANON=1
Note: anonymous access requires your self-hosted Puter to be configured appropriately.
`
      );
    }
  }

  try {
    const puter = init(authToken || undefined);
    return puter;
  } catch (error) {
    throw new Error(`Failed to initialize Puter with provided token: ${error.message}`);
  }
}

module.exports = {
  getPuterInstance,
};
