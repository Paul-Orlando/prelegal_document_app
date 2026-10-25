[![Deployed on Railway](https://img.shields.io/badge/deployed%20on-Railway-0B0D0E?style=flat&logo=railway)](https://prelegaldocumentapp-production.up.railway.app/)
[![Tests](https://img.shields.io/badge/tests-164%20passing-2f7d4f?style=flat)](docs/TESTING.md)
[![Assistant evaluation](https://img.shields.io/badge/assistant%20evaluation-99%25-b5862a?style=flat)](eval/results/2026-10-25_openai-gpt-4o-mini_after-fixes.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Prelegal

An AI-guided legal document app for a fictional Atlanta law firm, Ashford & Kane LLP. Pick an agreement, answer a few questions one at a time, and get a professionally typeset contract built on Common Paper's open standard terms, with an AI assistant and the firm's help desk a click away.

**Live demo:** https://prelegaldocumentapp-production.up.railway.app/

> **Demo only.** Prelegal shows what an AI legal-document service could look like. It is not a live legal service: every download is watermarked **SAMPLE** and marked not for use, nothing here is legal advice, and the firm, attorneys, phone numbers and prices are fictional. Don't use it for real legal matters.

## What it does

- **Pick an agreement from the top bar.** 11 standard agreements: Mutual NDA, Cloud Service, Service Level, Data Processing, Design Partner, Professional Services, Partnership, Business Associate, Software License, Pilot and AI Addendum.
- **One question at a time.** The AI interviewer asks for each detail in plain language and saves it to the document, shown live on the right. No chat history to scroll through; just the current question and a note of what was recorded.
- **Professional documents.** PDF and Word exports with the firm letterhead and scale-and-pen logo, a Key Terms table, numbered Standard Terms (1. / 1.1 / (a)), a signature page, and "Page X of Y" footers. Markdown too.
- **Ask Prelegal.** An AI chat on every screen that recommends the right agreement (with a button to start it), explains the question you're on, answers pricing questions and recommends a plan, and hands off to the help desk when it can't help.
- **Help & support.** Call the firm or the help desk, see the four attorneys and what each covers, or request a callback.
- **Pricing and plans.** An estimator that works out the cheapest option; $49 or $99 per agreement, a 6-month plan ($249) or a 12-month plan ($449), and attorney review ($195, or $150 for plan members). Prices were set against online legal services and Atlanta firm rates; see [docs/PRICING.md](docs/PRICING.md).
- **No sign-in.** Each browser gets its own private guest workspace; drafts save automatically under Drafts.
- **Day and night modes**, light by default, and a layout that works on phones.

## Demo safeguards

| Safeguard | What it does |
|---|---|
| Sample marking | Every page of every download carries a SAMPLE watermark and "not for use, not legal advice, and not to be signed"; filenames start with `SAMPLE-` |
| Demo notice | A "Demo only" strip on every page and a "Before you start" acknowledgment on the first visit |
| Usage limits | **2 new documents per visitor per hour** (a draft discarded before any answer is given back), with a backstop of 6 per network address (so clearing cookies doesn't give unlimited tries, and an office sharing one address isn't blocked); 40 answers per document; 20 Ask Prelegal questions per visitor per hour |
| Paywall, built but off | With `PRELEGAL_PAYMENTS=on`, downloads need a purchased agreement or an active plan. In the demo, downloads are free and the note above Download shows what it would cost |
| Spending | All limits are counted on the server. Set a monthly limit on the OpenRouter key as well |

## How it was tested

Three layers, the same approach as Gatewell Parts Desk. Details in [docs/TESTING.md](docs/TESTING.md).

**1. Automated tests: 164, free, no API key.** They run against a throwaway database with a scripted stand-in for the model, and cover visitor isolation, every usage limit, the interview, Ask Prelegal and help desk handoff, pricing, the paywall, PDF and Word exports for all 11 agreements, sample marking, input safety, security headers, the fallback when the AI service is down, and that no keys or real phone numbers are committed. They found and fixed two real bugs along the way.

**2. Assistant evaluation: 84% → 99%.** 45 graded questions in 7 groups, 3 runs each, against the real model (`openai/gpt-4o-mini`). The interviewer is graded on what it actually saved to the document, not just on its wording; Ask Prelegal on facts, prices, handoffs and refusals.

| | Baseline | After fixes |
|---|---|---|
| Runs passed | 113 of 135 (84%) | **134 of 135 (99%)** |
| Questions passed on every run | 36 of 45 (80%) | 44 of 45 (98%) |
| Help desk handoff correct | 47 of 63 | 63 of 63 |
| "Which agreement do I need?" group | 7% | 100% |
| Average reply time | 1.3 s | 1.2 s |
| Cost of the full run | $0.068 | $0.071 |

The interviewer passed every run from the start. The baseline failures were all in Ask Prelegal: it flagged ordinary answers for help desk handoff, named the wrong attorney, and wrote a poem when asked for one. The fixes were clearer instructions plus two server-side checks that don't rely on the model obeying them: a handoff only counts if the reply actually gives the help desk's number, and the View plans button only shows if the reply actually states a price. The one remaining failure was a correct answer the grader didn't recognise; after widening that check (logged in [eval/SCORING_CHANGES.md](eval/SCORING_CHANGES.md)), re-grading the saved answers gives 135 of 135. Full reports: [baseline](eval/results/2026-10-25_openai-gpt-4o-mini.md), [after fixes](eval/results/2026-10-25_openai-gpt-4o-mini_after-fixes.md), [rescored](eval/results/2026-10-25_openai-gpt-4o-mini_after-fixes_rescored.md).

**3. User testing.** A 20-minute session script with tasks done with and without the assistant, plus results and summary templates in [docs/user_test/](docs/user_test/), and a five-minute [demo script](docs/DEMO_SCRIPT.md). A simulated walkthrough with three participants (on a phone, on a laptop using the assistant first, and keyboard-only in night mode) found 12 problems, all fixed; the worst were arrow keys on the agreement menu starting a new document on every press, and the page sliding sideways on phones. [Summary](docs/user_test/summary_simulated_2026-10-25.md). Testing with real people is the next step.

## Run it locally

Requires Node.js 22.5 or later.

```
npm install
npm start
```

Open http://localhost:3000. Without an API key the app uses a scripted interviewer, so everything works for free. For the real AI, copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` (from https://openrouter.ai/keys). If the AI service fails mid-conversation, the app falls back to the scripted interviewer for that turn instead of breaking.

```
npm test                                # 164 automated tests, free
npm run eval -- --limit 3 --runs 1      # assistant smoke test, about $0.01
npm run eval                            # full evaluation, 45 questions × 3 runs, about $0.07
```

On Windows, `eval.bat` runs the evaluation the same way. See [eval/README.md](eval/README.md) for every option.

## Settings

All optional; see `.env.example`.

| Setting | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | none | Turns on the real AI; without it the scripted interviewer runs |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Model for both assistants; must support tool calling |
| `PRELEGAL_DEMO_MODE` | `on` | Sample marking and demo notice. `off` only for a real launch |
| `PRELEGAL_DEMO_LIMITS` | `on` | Usage limits. Only the evaluation runner switches them off |
| `PRELEGAL_PAYMENTS` | `off` | The paywall |
| `PRELEGAL_PAYMENT_PROVIDER` | none | `test` simulates payment locally; refused in production |
| `PORT`, `DB_PATH` | `3000`, `.data/prelegal.db` | Server port and database file |

## Deploy your own

1. Fork this repository.
2. Create a Railway project from it and set `OPENROUTER_API_KEY`.
3. Set a monthly spending limit on the key in your OpenRouter account.

Railway redeploys on every push to `main`, and uses `/api/health` (503 when the database can't be read) as the health check.

## How it's built

- **Frontend:** plain HTML, CSS and JavaScript in `public/`, no build step.
- **Backend:** Express in `server/`; `app.js` builds the app, `routes.js` holds the API, `rateLimit.js` the usage limits, `payments.js` the paywall, `pricing.js` the prices, `firm.js` the fictional firm.
- **Database:** SQLite through Node's built-in `node:sqlite`.
- **AI:** OpenRouter through the OpenAI SDK, in `server/ai/`. The interviewer can only set the agreement type, set that agreement's known fields, and mark it complete. Ask Prelegal (`support.js`) answers from the firm, pricing and agreement information it's given, with server-side checks on its handoff and pricing markers.
- **Documents:** `docModel.js` parses Common Paper's Standard Terms into numbered clauses; `pdfExport.js` (pdfkit) and `docxExport.js` (docx) typeset the same model with Libre Caslon embedded.
- **Project rules** for Claude Code are in [CLAUDE.md](CLAUDE.md).

## Known gaps

- The usage limits are kept in memory: they reset when the server restarts and aren't shared across several server instances. Fine for one demo instance; a real launch would use a shared store.
- Callback requests are saved but don't notify anyone yet.
- No real payment provider is connected; going live means adding one in `server/payments.js` (see [docs/PRICING.md](docs/PRICING.md)).
- Prices were benchmarked in October 2026 and should be rechecked before any launch.

## Credits and license

Agreements are built on the [Common Paper](https://commonpaper.com) standard agreements, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Libre Caslon is used under the SIL Open Font License (`server/assets/fonts/OFL.txt`).

This project is licensed under the MIT License; see [LICENSE](LICENSE).
