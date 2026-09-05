# Exotic-Butters

[![License](https://img.shields.io/github/license/Officialckazros/Exotic-Butters?style=flat-square&color=blue)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=flat-square&logo=discord&logoColor=white)

A small companion support bot for [KozzyX](https://github.com/Officialckazros/KozzyX), built on [discord.js](https://discord.js.org/) v14. It handles a few status, scan, and sync commands and replies when you mention it. That's it.

## Commands

| Command | What it does |
| --- | --- |
| `/status` | Shows support-bot status, main-bot connectivity, and WebSocket latency. |
| `/scan` | Runs a diagnostic scan and reports back. |
| `/sync` | Does a handshake and syncs with the KozzyX service. |
| Mention | Replies with a quick assist message when you ping the bot. |

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- A [Discord application and bot](https://discord.com/developers/applications)

## Setup

```bash
git clone https://github.com/Officialckazros/Exotic-Butters.git
cd Exotic-Butters
npm install
```

Then drop your credentials in a `.env` file:

```env
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
```

## Running it

```bash
npm start            # start the bot
npm run deploy       # register global slash commands
npm run deploy-guild # register commands to a single guild (handy for testing)
npm run cleanup      # remove registered commands
```

## Bonus: the Puter chat toolkit

Tucked in the repo is a small set of scripts for talking to AI models through [Puter](https://puter.com), separate from the bot itself.

- **In the browser, no API key:** open [example-puter-chat.html](example-puter-chat.html). It loads the Puter CDN and can call models without a key.
- **Server-side with Node:** run [example-puter-node.js](example-puter-node.js). You'll need a token from [puter.com/app/dev-center](https://puter.com/app/dev-center), set as `PUTER_AUTH_TOKEN` (env var or `.env`):

```bash
export PUTER_AUTH_TOKEN="your_token_here"
node example-puter-node.js
```

These follow the [Puter tutorial](https://developer.puter.com/tutorials/free-unlimited-claude-35-sonnet-api/).

### The `chatb` CLI: fallbacks and quota workarounds

`chatb` can fall back to other models, or call OpenRouter directly, when your Puter account hits a quota limit.

Environment variables:

- `PUTER_AUTH_TOKEN` - your Puter API token (recommended).
- `PUTER_API_ORIGIN` - point at a self-hosted Puter instance (e.g. `http://127.0.0.1:4100`).
- `PUTER_ALLOW_ANON=1` - allow anonymous local use against a self-hosted instance (dev only).
- `PUTER_FALLBACK_MODEL` - Puter model key to try as a fallback (e.g. `openrouter/free`).
- `OPENROUTER_API_KEY` - a direct OpenRouter key (optional). If set, `chatb` will try a direct OpenRouter call when Puter reports a quota error.
- `OPENROUTER_FALLBACK_MODEL` - model key for those direct calls (default: `openrouter/free`).

Normal run with a Puter token:

```bash
export PUTER_AUTH_TOKEN="your_token"
chatb
```

Against a self-hosted Puter instance:

```bash
git clone https://github.com/HeyPuter/puter
cd puter
npm install
npm start

# in another terminal, point chatb at your local Puter
export PUTER_API_ORIGIN="http://127.0.0.1:4100"
export PUTER_ALLOW_ANON=1
chatb
```

Direct OpenRouter fallback:

```bash
export OPENROUTER_API_KEY="sk_..."
export OPENROUTER_FALLBACK_MODEL="openrouter/free"
chatb
```

To keep usage down, lean on `/effort low` and only attach the files you actually need.

## License

MIT. See the [LICENSE](LICENSE) file.
