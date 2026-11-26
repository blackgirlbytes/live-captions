# Agent rules for Earshot

Instructions for AI coding agents (Claude Code, Codex, Cursor, …) working in this repo.

## Deepgram API key: who pays

The web server's `DEEPGRAM_API_KEY` pays for **every** caption session that server hands a token to. Its token endpoint (`/api/deepgram/token`) has no sign-in; it is only rate-limited per IP. Visitors never see the key, but they spend its credit.

Rules:

1. **Never set `DEEPGRAM_API_KEY` on a public deployment** (Vercel, Netlify, Fly, a shared server, anything reachable by other people). This applies to env files, hosting dashboards, CI secrets, and deploy scripts. Without it, visitors are asked for their own Deepgram key and pay for their own usage.
   - The only exception is when the owner explicitly says, in their own words, that they want to pay for visitors. In that case also set `EARSHOT_EXTENSION_IDS` and recommend real authentication or quotas.
2. **The owner's key belongs only in `apps/web/.env.local`** on their own machine. That file is git-ignored; never commit it, copy it elsewhere, or print its value. Don't use a key from another project or folder without asking the owner first.
3. **Keep the local dev server private.** `next dev` should listen on `127.0.0.1` only, so people on the same network can't use the owner's key.
4. **A user's own key ("bring your own key") stays in their browser** (localStorage / `chrome.storage.local`) and goes only to Deepgram. Never send it to the Earshot server, log it, or include it in messages to web pages or content scripts.
5. **Don't weaken these rules without the owner's say-so.** Ask before loosening the token endpoint's CORS, rate limit, or origin checks, or before adding any other way to spend the server key.

## Quick reference

| Setup | `DEEPGRAM_API_KEY` | Who pays |
|---|---|---|
| Owner's laptop | set in `apps/web/.env.local` | the owner (only they can reach it) |
| Public deployment | **unset** | each visitor, with their own key |
| Chrome extension with a user key | not needed (no server) | that user |

See [README.md](README.md) for setup, and [docs/provider-policies.md](docs/provider-policies.md) before changing anything about how YouTube content is shown or captured.
