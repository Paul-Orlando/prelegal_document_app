# Prelegal

An AI chat that interviews you about a legal agreement and builds it from Common Paper's open, CC BY 4.0-licensed standard templates.

## Live Demo

**Try it now:** https://prelegaldocumentapp-production.up.railway.app/

The app is deployed and running with OpenRouter AI integration.

## What it does

- Sign up, sign in — every user has their own private set of documents.
- Start a new document and describe what you need in plain language ("I need an NDA", "we're buying a SaaS product and need a contract").
- Prelegal asks about the details it needs, one or two at a time, and fills them into a live document as you answer.
- If you ask for something it doesn't support, it says so and offers the closest thing it can generate instead — it never fakes an unsupported document.
- Preview the assembled document at any point, and download it as Markdown, PDF, or Word (.docx) once it's ready.

Supported agreements: Mutual NDA, Cloud Service Agreement, Service Level Agreement, Data Processing Agreement, Design Partner Agreement, Professional Services Agreement, Partnership Agreement, Business Associate Agreement, Software License Agreement, Pilot Agreement, AI Addendum. See catalog.json for the full list with descriptions, and templates/ for the underlying Common Paper Standard Terms.

## Quick start

```
npm install
npm start
```

Then open http://localhost:3000. Without any configuration the app runs against a scripted interviewer (no AI, no API key needed) — it walks through the same required fields in order, so the whole app is testable for free.

To turn on the real AI chat, copy .env.example to .env and set OPENROUTER_API_KEY (get one at https://openrouter.ai/keys). Restart the server and the sidebar badge will switch from "AI chat: scripted" to "AI chat: OpenRouter". If the OpenRouter API call ever fails mid-conversation, the app automatically falls back to the scripted interviewer for that turn rather than breaking.

## Running as a background service

```
scripts/start.ps1   # Windows PowerShell
scripts/start.sh     # macOS/Linux
```

starts the server in the background and writes its PID to .data/server.pid. Use the matching stop.ps1 / stop.sh to shut it down. Logs land in .data/server.log.

## Architecture

- **Frontend** — static HTML/CSS/vanilla JS in public/, no build step.
- **Backend** — Express (server/), a small REST API under /api.
- **Database** — SQLite via Node's built-in node:sqlite (no native dependency to compile). File lives at .data/prelegal.db by default.
- **AI** — server/ai/ defines a provider interface with two implementations: openrouterProvider.js (real calls to OpenRouter's Chat Completions API, with function calling) and mockProvider.js (deterministic script). server/ai/index.js picks one based on whether OPENROUTER_API_KEY is set.
- **Document model** — server/documentSpecs.js defines the fields for each supported agreement, derived from the variables the underlying Common Paper Standard Terms actually reference. server/render.js turns field values into a Prelegal-authored cover page followed by the incorporated Standard Terms.
- **Export** — server/exporters.js renders the same document to PDF (via pdfkit, with a small purpose-built markdown renderer — not a full CommonMark implementation) and to Word (via markdown-it → HTML → html-to-docx). GET /api/documents/:id/download?format=md|pdf|docx serves whichever format is requested.
- **Rate limiting** — server/rateLimit.js is a minimal in-memory limiter keyed by client IP, applied to new-document creation (3/hour). It's single-process and resets on restart, not a production rate limiter.

Only the Mutual NDA repo publishes a fillable cover page upstream — every other Common Paper agreement is Standard Terms only, so Prelegal authors its own cover page for those, built from the variables each agreement's Standard Terms reference.

## Known gaps

- Passwords are hashed with scrypt and sessions use random-token cookies — solid for a small deployment, but there's no rate limiting, email verification, or password reset flow.
- No test suite yet; the flows above were verified manually end-to-end (registration, multi-user isolation, chat interview, preview, download) for this build.
- npm audit reports a moderate advisory in Express's bundled qs (query-string parsing) — this app never parses query strings, so it isn't exploitable here, but a future Express major-version upgrade would clear it. It also reports a high-severity advisory in image-size (a transitive dependency of html-to-docx, used to size embedded images) — this app never embeds images in generated documents, so that parser is never invoked here.
- The rate limiter is per-process, in-memory state — restarting the server (or running more than one instance) resets/fragments the counts. Fine for a single demo instance, not for a real deployment.
- The PDF export uses a small hand-rolled markdown renderer (headings, bold, tables, rules) rather than a full CommonMark-to-PDF pipeline, so it won't perfectly reproduce every markdown construct — it covers everything the templates in this app actually use.
