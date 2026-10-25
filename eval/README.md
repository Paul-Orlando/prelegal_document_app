# Assistant evaluation

Grades the two AIs in Prelegal against a fixed question set, the way the Gatewell Parts Desk evaluation did:

- **The interviewer** (one question at a time while drafting) is graded on **what it saved to the document**, not just on its wording.
- **Ask Prelegal** (the support chat) is graded on its reply: facts, prices, help desk handoffs and refusals.

It calls the real model, so it costs money and isn't part of `npm test`. `test/evalSet.test.js` checks the question set and the grader for free.

## Run it

```
npm run eval -- --limit 3 --runs 1      # smoke test: 3 questions, 1 run, about $0.01
npm run eval                            # all 45 questions, 3 runs each
npm run eval -- --group pricing         # one group
npm run eval -- --only rec-02 sup-price-04
npm run eval -- --model anthropic/claude-haiku-4.5 --label haiku
npm run eval -- --mock --runs 1         # check the runner with the scripted stand-in (free, not a score)
npm run eval -- --rescore eval/results/<file>.csv
```

On Windows, `eval.bat` does the same (`eval.bat --limit 3 --runs 1`). The key comes from `OPENROUTER_API_KEY`, which the app reads from `.env`; it's never printed or saved, and anything that looks like a key is removed from saved answers. The per-visitor demo limits are switched off for the run, and it uses a throwaway database.

Results go to `eval/results/<date>_<model>[_<label>].csv` (one row per run, with the full answer) and `.md` (pass rate, consistency, results by group and by check, time, cost, and every failure with the answer given). When a scoring rule changes, `--rescore` re-grades saved answers without calling the model; log the change and the reason in `SCORING_CHANGES.md`.

## Groups

| Group | Questions | What it covers |
|---|---|---|
| interview | 13 | First question after picking an agreement, recording answers (several at once, defaults, corrections, dates, money), finishing |
| guardrails | 10 | Unsupported documents, legal advice, off-topic, prompt injection, prompt leaks, inventing values, using a demo document |
| recommend | 5 | Which agreement fits a situation |
| app-and-firm | 6 | How the app works; firm phone, address and the right attorney |
| pricing | 6 | Prices, plans, recommending single vs plan, attorney review, not inventing discounts |
| handoff | 3 | Billing, bugs and "a real person" go to the help desk |
| context | 2 | Explaining the question on screen |

## Question fields

| Field | Meaning |
|---|---|
| `id`, `group`, `kind` | `kind` is `interview` or `support` |
| `spec`, `prefill`, `turns` | interview: the agreement, answers already saved before it starts, and what the user types after the first question (empty: grade the first question) |
| `messages`, `context` | support: what the user types, and optionally the agreement and question on screen |
| `expect_facts` | data that must appear in the reply; each entry is a list of accepted spellings. Must exist in the app's data (checked by `test/evalSet.test.js`) |
| `expect_words` | wording that must appear, each entry a list of accepted spellings |
| `forbid` | must not appear in the reply |
| `expect_values` | interview: fields that must be saved, with accepted spellings |
| `expect_empty`, `forbid_values` | interview: fields that must stay empty; values no field may hold |
| `expect_status` | interview: `complete` or `draft` at the end |
| `expect_escalate`, `expect_pricing` | support: help desk handoff and View plans button: `true`, `false` (default), or `"optional"` |

Matching ignores case, dollar signs, commas and dash styles. Numbers match whole (49 doesn't match 249), and phone numbers match by their digits. Interview replies must also keep to one question at a time: at most 2 question marks and 110 words. Replies over 8 seconds are flagged, not failed.
