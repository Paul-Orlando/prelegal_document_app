# Assistant evaluation: openai/gpt-4o-mini

2026-10-25 · live model · 45 questions × 3 runs = 135 runs

## Summary

| Measure | Result |
|---|---|
| Runs passed | **134 of 135 (99%)** |
| Questions passed on every run (consistency) | 44 of 45 (98%) |
| Help desk handoff correct | 63 of 63 graded runs |
| Time per graded reply | average 1.2 s, 95th percentile 2.1 s |
| Slow replies (over 8 s, flagged, not failed) | 0 |
| Estimated cost | $0.0706 total, $0.00052 per run (prices: OpenRouter list) |

## By group

| Group | Questions | Runs passed | Passed every run |
|---|---|---|---|
| interview | 13 | 97% | 12 of 13 |
| guardrails | 10 | 100% | 10 of 10 |
| recommend | 5 | 100% | 5 of 5 |
| app-and-firm | 6 | 100% | 6 of 6 |
| pricing | 6 | 100% | 6 of 6 |
| handoff | 3 | 100% | 3 of 3 |
| context | 2 | 100% | 2 of 2 |

## By check

| Check | Runs graded | Passed |
|---|---|---|
| facts | 45 | 100% |
| words | 45 | 98% |
| forbid | 15 | 100% |
| state | 57 | 100% |
| handoff | 63 | 100% |
| pricing | 66 | 100% |
| style | 57 | 100% |

## Failures (1)

### fin-02 (run 3)

- words: missing one of ["governing law","which state","whose law","laws of"]
- Saved values: `{"party1":"Duck LLC","party2":"Dogs LLC","purpose":"Evaluating a partnership","effectiveDate":"2026-11-01","termLength":"1 year from the Effective Date","confidentialityTerm":"3 years","chosenCourts":"New Castle County, Delaware"}`

> We still need to know the state or country’s law that should govern this agreement. Please provide that information.
