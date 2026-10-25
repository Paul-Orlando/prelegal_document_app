[![Deployed on Railway](https://img.shields.io/badge/deployed%20on-Railway-0B0D0E?style=flat&logo=railway)](https://railway.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Prelegal

An AI chat that interviews you about a legal agreement and builds it from Common Paper's open, CC BY 4.0-licensed standard templates.

## Live Demo

**Try it now:** https://prelegaldocumentapp-production.up.railway.app/

The app is deployed and running with OpenRouter AI integration.

### Demo mode — no sign-in

There is no login. Each browser is given its own guest workspace automatically the first time it opens the app, so drafts stay private to that browser.

## Features

- 📋 11 supported agreement types
- 🤖 Multi-turn AI interview
- 📥 Export as Markdown, PDF, or Word
- 🧭 Agreement picker in the top bar, one question at a time
- 🛟 Help & support panel: firm phone numbers, attorneys, an AI support assistant that hands off to the help desk, and callback requests
- 🔐 Per-browser guest workspaces (no sign-in)
- 🚀 Deploy-ready with Railway

## Deploy Your Own

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

1. Fork this repo
2. Set `OPENROUTER_API_KEY` in Railway variables
3. Deploy

## What it does

- Pick an agreement from the menu in the top bar (or from the list on the home page).
- Prelegal asks one question at a time and fills each answer into the document, shown live on the right. Earlier questions aren't shown, just the current one and a confirmation of what was recorded.
- Drafts save automatically and are listed under **Drafts** in the top bar.
- **Help & support** (top right) has the firm's main line and help desk, the attorney directory, an AI support assistant, and a callback request form. When the assistant can't answer, it points the user to the help desk.
- If you ask for something it doesn't support, it says so and offers the closest thing it can generate instead — it never fakes an unsupported document.
- Preview the assembled document at any point, and download it as Markdown, PDF, or Word (.docx) once it's ready.

Supported agreements: Mutual NDA, Cloud Service Agreement, Service Level Agreement, Data Processing Agreement, Design Partner Agreement, Professional Services Agreement, Partnership Agreement, Business Associate Agreement, Software License Agreement, Pilot Agreement, AI Addendum. See `catalog.json` for the full list with descriptions, and `templates/` for the underlying Common Paper Standard Terms.

## Quick start

```
npm install
npm start
```

Then open http://localhost:3000. Without any configuration the app runs against a **scripted interviewer** (no AI, no API key needed) — it walks through the same required fields in order, so the whole app is testable for free.

To turn on the real AI chat, copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` (get one at https://openrouter.ai/keys). Restart the server and the sidebar badge will switch from "AI chat: scripted" to "AI chat: OpenRouter". If the OpenRouter API call ever fails mid-conversation, the app automatically falls back to the scripted interviewer for that turn rather than breaking.

## Running as a background service

```
scripts/start.ps1   # Windows PowerShell
scripts/start.sh     # macOS/Linux
```

starts the server in the background and writes its PID to `.data/server.pid`. Use the matching `stop.ps1` / `stop.sh` to shut it down. Logs land in `.data/server.log`.

## Architecture

- **Frontend** — static HTML/CSS/vanilla JS in `public/`, no build step.
- **Backend** — Express (`server/`), a small REST API under `/api`.
- **Database** — SQLite via Node's built-in `node:sqlite` (no native dependency to compile). File lives at `.data/prelegal.db` by default.
- **AI** — `server/ai/` defines a provider interface with two implementations: `openrouterProvider.js` (real calls to OpenRouter's Chat Completions API, with function calling) and `mockProvider.js` (deterministic script). `server/ai/index.js` picks one based on whether `OPENROUTER_API_KEY` is set.
- **Document model** — `server/documentSpecs.js` defines the fields for each supported agreement, derived from the variables the underlying Common Paper Standard Terms actually reference. `server/render.js` turns field values into a Prelegal-authored cover page followed by the incorporated Standard Terms.
- **Export**: `server/docModel.js` parses the Standard Terms into numbered clauses (1. / 1.1 / (a)) and builds one document model; `server/pdfExport.js` (pdfkit) and `server/docxExport.js` (`docx`) typeset it with the Prelegal letterhead and logo, a Key Terms table, numbered Standard Terms, a signature page with drawn signature lines, a running header and "Page X of Y" footers. Unfinished documents are marked "Draft — not for signature". Libre Caslon (SIL Open Font License, `server/assets/fonts/`) is embedded in both formats. `GET /api/documents/:id/download?format=md|pdf|docx` serves whichever format is requested.
- **Rate limiting** — `server/rateLimit.js` is a minimal in-memory limiter keyed by client IP, applied to new-document creation (3/hour). It's single-process and resets on restart, not a production rate limiter.

Only the Mutual NDA repo publishes a fillable cover page upstream — every other Common Paper agreement is Standard Terms only, so Prelegal authors its own cover page for those, built from the variables each agreement's Standard Terms reference.

## Firm details

The firm shown in the app (Ashford & Kane LLP, its address, phone numbers, attorneys and help desk) is **fictional demo data**. Edit `server/firm.js` to replace it; the UI and the support assistant both read from that one file.

## Known gaps

- Callback requests are stored in the `support_tickets` table but nothing notifies anyone yet; wire it to email or your help desk tool before real use.

- Passwords are hashed with scrypt and sessions use random-token cookies — solid for a small deployment, but there's no rate limiting, email verification, or password reset flow.
- No test suite yet; the flows above were verified manually end-to-end (registration, multi-user isolation, chat interview, preview, download) for this build.
- `npm audit` reports a moderate advisory in Express's bundled `qs` (query-string parsing) — this app never parses query strings, so it isn't exploitable here, but a future Express major-version upgrade would clear it.
- The rate limiter is per-process, in-memory state — restarting the server (or running more than one instance) resets/fragments the counts. Fine for a single demo instance, not for a real deployment.
- Signature blocks are drawn as blank lines for wet or PDF signatures; there is no e-signature integration.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

MIT License

Copyright (c) 2026 Paul Orlando

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
