// Load .env only for local runs - Railway injects vars directly.
if (!process.env.RAILWAY_ENVIRONMENT) {
    require('dotenv').config();
}