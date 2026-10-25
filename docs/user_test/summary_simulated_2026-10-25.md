# User test summary (simulated): Prelegal

**Date:** 2026-10-25 · **App version:** `32cf582` (live at the time), fixes in the following commit
**Participants:** 3 simulated participants, run by Claude driving a real browser through `docs/user_test/script.md`

> **Read this first.** This was a simulated walkthrough, not a test with real people. Each participant was played by Claude, clicking and typing through the actual app in a browser at their device size. It reliably finds hidden buttons, extra steps, layout problems and keyboard traps. It can't measure how long real people take, what they misread, or whether they trust the result, because the tester already knows the app. Times are therefore not recorded; steps are counted instead. Run the same script with 3 to 5 real people before drawing conclusions about usability.
>
> The local test server had no OpenRouter key, so the interviewer and Ask Prelegal used the scripted stand-in. For the Ask Prelegal tasks, the result shown is the live model's result on the matching evaluation question (`eval/results/2026-10-25_openai-gpt-4o-mini_after-fixes.md`, 3 runs each).

## Participants

| | Who | Device | Order for tasks 2–5 |
|---|---|---|---|
| P1 Dana | Owns a small bakery; not technical; has never drafted a contract | Phone (390 × 844) | Screens first |
| P2 Marcus | Operations manager at a software company; signs vendor contracts often | Laptop, light mode | Ask Prelegal first |
| P3 Leo | Startup founder; impatient; keyboard only | Laptop, night mode | Screens first |

## Task 1: drafting an agreement

| Participant | Steps | Success | Where they got stuck |
|---|---|---|---|
| P1 Dana | 20 taps | Yes, with difficulty | The page slid sideways once a long answer was recorded; after the last question the Download button was 1,569 px down the page with nothing pointing to it; the Ask Prelegal button covered Download |
| P2 Marcus | 13 actions | Yes | Asked Ask Prelegal to set the agreement up; it could only tell him which one to use, so he had to close the chat and find it in the menu |
| P3 Leo | Keyboard only | Yes, but at a cost | Pressing ↓ on the agreement menu to browse it started a document on every press, which would use up the 2-per-hour allowance before he'd chosen |

## Tasks 2–5: screens vs Ask Prelegal

| Task | Screens | Ask Prelegal (live model, evaluation question) |
|---|---|---|
| 2 Agreement for personal data | Success for all three: the agreement list's descriptions mention "personal data" | Success, 3 of 3 runs (`sup-rec-03`) |
| 3 Cheapest way to pay for 10 Cloud Service Agreements | **Struggled.** The Pricing page gave prices but not the comparison; Dana would have to work out 10 × $99 = $990 vs $449 herself, on a page over four phone screens long | Success, 3 of 3 runs (`sup-price-04`) |
| 4 Lawyer for privacy | Success: the attorney list in Help & support says Daniel R. Kane covers privacy (on a phone, after scrolling) | Success, 3 of 3 runs (`sup-firm-03`) |
| 5 Download keeps failing | Success: the help desk number is at the top of Help & support | Success, 3 of 3 runs (`sup-hand-02`) |

## What worked well

- The "Before you start" notice and demo strip were clear about the app being a demo.
- One question at a time, with the document filling in beside it, was easy to follow on every device.
- Enter submits answers; Help and the chat open with focus inside them, close with Escape, and return focus.
- Night mode had good contrast throughout.
- The fixed phone layout, the Help panel and the attorney list read well at phone size.

## Problems found and changes made

| # | Problem | Who | Severity | Change | Re-test |
|---|---|---|---|---|---|
| 1 | Arrow keys on the agreement menu started a document on every press, using up the hourly allowance | Leo | High | Arrow keys now only browse; Enter starts the agreement shown; a mouse or tap still starts immediately | 4 arrow presses: 0 documents; Enter: 1 |
| 2 | Picking the wrong agreement and switching used up one of the 2 documents | All | High | A discarded draft with no answers gives the visitor's document back (the per-address backstop still counts it) | Changed mind twice, still able to start another |
| 3 | On phones the page slid sideways when a long answer was recorded | Dana | High | Phone layout column can no longer be stretched by long text | Page stays 390 px wide |
| 4 | After the last question, Download was far down the page on phones | Dana | Medium | A Download button appears next to Continue as soon as the agreement is complete | Visible beside Continue |
| 5 | The Ask Prelegal button covered the Download button on phones | Dana | Medium | Extra space at the bottom of the page on phones | Download clear of the button |
| 6 | The demo strip took about an eighth of the phone screen | Dana | Low | One short line on phones | One line |
| 7 | The Pricing page didn't show the comparison people need | Dana, Marcus | Medium | "Work out the cheapest option" estimator, calculated on the server from the price list | 10 Commercial over 12 months: $449, saves $541 |
| 8 | Ask Prelegal couldn't start the agreement it recommended | Marcus | Medium | Recommended agreements get a "Start a …" button | One click to drafting |
| 9 | The scripted fallback answered "confidential plans" with prices | Marcus | Low | Tighter pricing rule; an NDA rule; the demo-use rule kept first | "Confidential plans" gets the NDA; "Can I use this NDA?" still gets "No" |
| 10 | Tab could move behind the "Before you start" notice and the purchase dialog | Leo | Medium | Keyboard focus stays inside open dialogs; after the notice, focus moves to the agreement menu | Tab stays in the notice |
| 11 | Arrow keys didn't move through the Drafts menu | Leo | Low | ↑ and ↓ move between drafts | — |
| 12 | The Details panel showed dates as "2026-11-01" | Leo | Low | Shown as "November 1, 2026", as in the document | — |

Automated tests were added for 1–2, 7–9 and the estimator arithmetic (164 tests in total).

## Still open

- On phones the floating Ask Prelegal button can sit over content partway down a page while scrolling (the end of the page is now clear). A real test will show whether people mind.
- The scripted interviewer, used only when the AI service is down, still asks people to type "done" to finish; the "I'm done" button does the same.
- **Run the script with real people.** This walkthrough can't tell you whether people trust the documents, understand the demo notice, or would use the service.
