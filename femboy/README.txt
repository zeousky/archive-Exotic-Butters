The /femboy command now grabs live NSFW femboy images/gifs/videos from the web.

Default source: e621.net (public API, no account needed, lots of quality femboy content)

To use Rule34.xxx instead:
  1. Sign up for a free account at https://rule34.xxx/
  2. Visit your account options page and generate an API key (check "Generate New Key?")
  3. Add these to your environment (local .env or Railway/etc vars):
       RULE34_USER_ID=123456
       RULE34_API_KEY=your_api_key_here
  The bot will prefer rule34 when both vars are present.

No local files are required. Drop nothing in this folder (it is gitignored anyway).

If a fetch fails or media is too large for attachment it will send direct URLs instead.
