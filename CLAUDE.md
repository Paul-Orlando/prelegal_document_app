# Prelegal — rules for Claude Code

AI-guided legal document demo for the fictional firm Ashford & Kane LLP. Express backend (`server/`), plain-JS frontend (`public/`, no build step), SQLite via `node:sqlite`, AI through OpenRouter. Deployed on Railway from `main`.

## Never weaken these
- **Demo mode** (`PRELEGAL_DEMO_MODE`, on by default): every download is watermarked SAMPLE and marked not for use; the site shows the demo notice and first-visit acknowledgment. Never remove the marking or make demo mode default to off.
- **Isolation:** every document route uses `requireAuth` and every query filters by the visitor's `user_id`. One visitor must never reach another's documents.
- **Demo limits** (`LIMITS` in `server/rateLimit.js`): 2 new documents per visitor per hour with a per-address backstop, 40 answers per document, and Ask Prelegal questions per hour. Counted on the server, on by default. Only the evaluation runner and local user-test sessions switch them off; never the live site.
- **Paywall** (`server/payments.js`, `PRELEGAL_PAYMENTS`, off by default): prices always come from `server/pricing.js` on the server, never from the request. The `test` payment provider must stay refused in production.
- **Prices** live only in `server/pricing.js`. Derived numbers (per month, break-even) are computed, never hand-typed.
- **AI tools** (`server/ai/tools.js`): the model can only set the agreement type, set known fields, and mark complete. Field values are validated against the agreement's fields.
- **Errors:** unexpected errors are logged and never sent to the browser.

## Before saying a change is done
- Run `npm test` and make sure everything passes. Never delete or loosen a test to make a change pass; if an isolation, demo-mode or paywall test fails, the change is wrong.
- For changes to prompts, tools or the support assistant, run `npm run eval -- --limit 3 --runs 1` and report the result; for larger changes, run the group that's affected.
- For changes to `server/payments.js`, `server/routes.js`, `server/rateLimit.js` or the AI prompts, explain the security impact in the summary.

## Secrets and data
- Never read, print or commit `.env` or any API key. Use `.env.example` for placeholders.
- The firm, attorneys, phone numbers (555-01xx) and emails (`.example`) are fictional. Don't add real contact details.

## Commits
- Commits: author Paul-Orlando with the GitHub no-reply email; no Co-Authored-By, session or AI-attribution lines in commit messages.

## Style
- Plain, readable JavaScript with short comments. User-facing text in plain, sentence-case English.
- Interface: keep the ink, paper and brass design; light by default; responsive to phone width; visible keyboard focus.
