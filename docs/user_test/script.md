# User test script: Prelegal

**Goal:** see whether people can draft an agreement on their own, and whether Ask Prelegal helps them answer everyday questions faster and more accurately than the screens alone.
**Length:** 20 minutes per person. **People:** 3 to 5. **You need:** this script, a stopwatch, `results_template.csv`.

| Part | Time |
|---|---|
| Intro and consent | 2 min |
| Task 1: draft an agreement | 5 min |
| Tasks 2–5, each done two ways | 10 min |
| Three closing questions | 3 min |

---

## Before each session (facilitator)

1. Start the app with `npm start` and open http://localhost:3000 in a **new private window** for each person, so they start with no drafts and see the "Before you start" notice.
2. The demo limits allow 30 new documents and 60 chat questions per hour from one address, which is plenty for a session. For back-to-back sessions on one computer, restart the app between people.
3. Check the participant's **order** below and set up `results_template.csv`.
4. Keep the answer key (end of this document) where the participant can't see it.

### Order: half start with the screens, half with Ask Prelegal

Doing a task the second time is easier, whichever way comes second. So for tasks 2–5, half the participants use the **screens first** and half use **Ask Prelegal first**.

| Participant | Order for tasks 2–5 |
|---|---|
| P1 | Screens first |
| P2 | Ask Prelegal first |
| P3 | Screens first |
| P4 | Ask Prelegal first |
| P5 | Screens first |

---

## Intro (read aloud)

> Thanks for helping. We're testing the app, not you. If something is hard, that's useful for us to know.
>
> This is a demo of a legal document service. **The law firm, attorneys, phone numbers and prices are made up, and every document it produces is a watermarked sample.** Please don't use anything from it for real.
>
> First I'll ask you to draft one agreement start to finish. Then four short questions, each answered twice: once using only the screens, and once by asking the assistant. Please think out loud. I'll stop each try after 3 minutes.

**Consent (read aloud, note the answer):**

> Is it OK if I time you and take notes on what you say? Your name won't be in the results.

---

## Tasks (read each aloud, start the stopwatch)

**Task 1 (once, any way you like).** "Your company, Duck LLC, is about to share confidential plans with Dogs LLC. Draft the agreement you'd sign first, using Delaware law, and download it as a Word file."
Success: a Mutual NDA with both names and Delaware saved, downloaded as Word. Note any question they got stuck on.

**Task 2.** "A vendor will process your customers' personal data. Which agreement do you need?"

**Task 3.** "You expect to need about 10 Cloud Service Agreements over the next year. What's the cheapest way to pay, and how much would you save?"

**Task 4.** "You want a lawyer to look at a privacy agreement. Who should you call, and on what number?"

**Task 5.** "Your download keeps failing. How do you get help?"

For tasks 2–5, "screens" means anything except the Ask Prelegal chat (menus, Pricing, Help & support). "Ask Prelegal" means asking the chat.

---

## Closing questions

1. What was confusing or slowed you down?
2. Which parts would you actually use, and why?
3. On a scale of 1 to 5, how much would you trust a document from the live version of this service?

---

## Answer key (facilitator only)

| Task | Correct answer |
|---|---|
| 1 | Mutual Non-Disclosure Agreement; Party 1 Duck LLC, Party 2 Dogs LLC, governing law Delaware; downloaded as `SAMPLE-MNDA-…docx` |
| 2 | Data Processing Agreement |
| 3 | The 12-month plan, $449, instead of 10 × $99 = $990 one at a time; saves $541 |
| 4 | Daniel R. Kane, Senior Partner (privacy and data protection), (404) 555-0111 |
| 5 | The help desk: (404) 555-0199 or helpdesk@ashfordkane.example, or a callback request from Help & support |

A task succeeds when the answer is correct within 3 minutes without the facilitator's help.
