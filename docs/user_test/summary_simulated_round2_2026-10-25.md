# User test summary (simulated, round 2): Prelegal

**Date:** 2026-10-25 · **App version:** `ae41280` (live at the time), fixes in the following commit
**Participants:** 3 new simulated participants, run by Claude driving a real browser through `docs/user_test/script.md`

> **Read this first.** Like round 1 (`summary_simulated_2026-10-25.md`), this was a simulated walkthrough, not a test with real people. It finds layout, keyboard, screen-reader and flow problems reliably; it can't tell you how real people feel or whether they trust the result. The accessibility checks used **axe-core 4.14**, the standard automated checker, against WCAG 2.1 A and AA plus best practices; automated checks catch a large share of problems but not all, so a session with a real screen-reader user is still worth doing. The server ran the live code with the demo limits on and the scripted stand-in for the AI.

## Participants

| | Who | Setup | What they stressed |
|---|---|---|---|
| P4 Rosa | Retired bookkeeper helping her son's business; reads with text enlarged | Tablet, browser zoomed to 125% (lays out at 656 px) | Coming back to a draft the next day, requesting a callback |
| P5 Sam | Blind; uses a screen reader | Laptop, keyboard and screen reader | Names, headings, regions and announcements on every screen, in both themes |
| P6 Jordan | Runs a 3-person agency; on a train; changes their mind | Phone, night mode, slow mobile network (400 ms latency, about 400 kbit/s), plus a dropped connection | Feedback while waiting, switching agreements, the hourly limit, losing signal mid-answer |

## Results

| Participant | Task 1 (draft an NDA) | What went wrong |
|---|---|---|
| P4 Rosa | Completed, after finding the Drafts menu | Returning the next day, the home page showed no sign of her draft; she couldn't find how to request a callback (the form only appeared after a chat handoff) |
| P5 Sam | Completed | axe found 6 kinds of issue on every screen; no main heading while drafting; tabs not linked to panels |
| P6 Jordan | Completed | About a second of no feedback after picking an agreement; **a second pick made just after the first question appeared was silently ignored** (found while re-testing, introduced by this round's own fix); Drafts menu ran off the phone screen; "Failed to fetch" when the signal dropped, with the question replaced by the error |

What worked well: the 125% zoom layout; resuming at exactly the right question; the estimator; every new question and chat reply announced to screen readers; no colour-contrast problems in either theme; answers kept in the box when the connection dropped; the 2-per-hour limit and the refund for changed minds behaving exactly as designed on a slow network.

## Problems found and changes made

| # | Problem | Who | Severity | Change | Re-test |
|---|---|---|---|---|---|
| 1 | No sign of an unfinished draft on the home page for a returning visitor | Rosa | Medium | "Welcome back" card: which agreement, how many details are filled in, and a Continue button | "Your Mutual Non-Disclosure Agreement has 3 of 8 details filled in"; Continue opens the right question |
| 2 | Callback requests only reachable after a chat handoff (also used by the Pricing page's plan buttons) | Rosa | High | "Request a callback" in Help & support, always | Request sent, reference shown |
| 3 | Button names didn't match their visible text (speech control) | Sam | Serious (axe) | Names now come from the visible text; text hidden on small screens stays available to screen readers | 0 violations |
| 4 | Saved-details panel could scroll but not be reached by keyboard | Sam | Serious (axe) | Panels focusable and labelled as tab panels | 0 violations |
| 5 | No main heading while drafting | Sam | Moderate (axe) | The agreement name is the page's main heading | H1 present |
| 6 | Demo notice outside any page region | Sam | Moderate (axe) | Named "Demo notice" region | 0 violations |
| 7 | Help and chat headers announced as extra page banners; Help used the wrong element for a dialog | Sam | Moderate/minor (axe) | Plain containers inside the dialogs | 0 violations |
| 8 | Details/Preview tabs not linked to their panels; saved details not a list | Sam | Manual check | Tabs control their panels; details are a list | Checked |
| 9 | No feedback for about a second after picking an agreement on a slow connection | Jordan | Medium | "Setting up your …" appears at once | Shown within 250 ms |
| 10 | A pick made while the Drafts list refreshed was silently ignored | Jordan | High | The menu is free as soon as the question appears; if setup really is still running, the person is told instead of ignored | Changing mind on the slow connection works |
| 11 | Drafts menu ran off the side of a phone screen | Jordan | Medium | Spans the screen on phones | Fits |
| 12 | "Failed to fetch" and the question disappearing when offline; same jargon in Preview | Jordan | Medium | Plain message under the question ("Your answer wasn't sent: you seem to be offline. It's still in the box below…"); Preview says it needs a connection | Question kept, answer kept, saved after reconnecting |

**Accessibility, before and after (axe-core 4.14, 12 screens and states in light and night mode):**

| | Before | After |
|---|---|---|
| Serious | 2 kinds (button names on every screen; the details panel while drafting) | 0 |
| Moderate | 4 kinds | 0 |
| Minor | 1 | 0 |
| Colour contrast | 0 | 0 |

Six automated tests were added for these fixes (171 tests in total).

## Still open

- A real screen-reader user should try it: automated checks don't judge whether announcements make sense in order.
- The first screen took about 3.4 seconds on the simulated slow connection, but that figure is inflated: the test environment blocks the font host, so the browser waited for fonts that never arrived. Measure it on a real phone before drawing conclusions.
- Run the script with real people.
