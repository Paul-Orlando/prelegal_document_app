# Testing

Three layers, the same approach as Gatewell Parts Desk.

| Layer | What it answers | How | Cost |
|---|---|---|---|
| 1. Automated tests | Does the app work, and does it stay safe? | `npm test` | Free, no key |
| 2. Assistant evaluation | How good are the AI's answers? | `npm run eval` (see `eval/README.md`) | About $0.01 for the smoke test |
| 3. User test | Can people use it, and does the assistant help? | `docs/user_test/script.md` | 20 minutes per person |

## 1. Automated tests

`npm test` runs every file in `test/` against a throwaway database with the scripted interviewer, so it needs no API key and never touches real data. It covers guest sessions and isolation between visitors, documents and demo limits, the interview, Ask Prelegal and help desk handoff, callback requests, pricing, the paywall (off and on), PDF and Word exports for all 11 agreements, sample marking, clause numbering, input safety, security headers, error handling, the fallback when the AI service is down, the evaluation set and its grader, and that no keys or real phone numbers are committed.

## 2. Assistant evaluation

Start with the smoke test, then the full set:

```
npm run eval -- --limit 3 --runs 1
npm run eval
```

Fix what fails, re-run, and keep each result file: the before-and-after reports are the evidence. When a grading rule changes, re-grade old results with `--rescore` and log it in `eval/SCORING_CHANGES.md`.

## 3. User test

A simulated walkthrough with 3 participants (phone, laptop with the assistant first, keyboard only in night mode) was run on 2026-10-25 and found 12 problems, all fixed: see `docs/user_test/summary_simulated_2026-10-25.md`. It isn't a substitute for real people.

Run `docs/user_test/script.md` with 3 to 5 people, record results in `results_template.csv`, and write up `summary_template.md`, including the changes made because of feedback.

## Before a demo

Follow `docs/DEMO_SCRIPT.md`.
