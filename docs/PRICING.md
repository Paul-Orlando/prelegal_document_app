# Pricing and plans

Demo pricing for Prelegal by Ashford & Kane LLP (a fictional firm). No payment is taken in the app; choosing a plan opens a help desk callback request.

The prices live in `server/pricing.js`. The Pricing page, the price note on each document, and the Ask Prelegal assistant all read from that one file, and derived numbers (monthly equivalents, break-even counts) are computed there, never typed by hand. `test/pricing.test.js` checks them.

## The prices

| Option | Price | What's included |
|---|---|---|
| Essential agreement | $49 each | Mutual NDA, Pilot, AI Addendum, Service Level, Design Partner |
| Commercial agreement | $99 each | Cloud Service, Professional Services, Data Processing, Business Associate, Software License, Partnership |
| 6-month plan | $249 (about $41.50 a month) | Unlimited agreements, 1 attorney review |
| 12-month plan | $449 (about $37.42 a month) | Unlimited agreements, 3 attorney reviews, priority callbacks |
| Attorney review | $195, or $150 for plan members | An attorney reviews the finished agreement and calls within 2 business days |

Plans are paid upfront and don't renew automatically. The 6-month plan costs the same as 3 Commercial agreements bought singly; the 12-month plan, 5.

## How the prices were set

Prelegal sits between online legal-form services and hiring a law firm: the agreements are standard terms the firm stands behind, assembled through the interview, with an attorney available.

**Online services (prices current in 2026)**
- LegalZoom: single legal form $59; unlimited form library $99 a year; Business Attorney Plan $39.09 a month on a 1-year plan or $43.17 a month on a 6-month plan, about $469 a year. ([NerdWallet, Mar 2026](https://www.nerdwallet.com/business/legal/learn/legalzoom-review); [AI Lawyer, Jun 2026](https://ailawyer.pro/blog/rocket-lawyer-vs-legalzoom))
- Rocket Lawyer: memberships $149, $249 or $349 a year; documents are only available with a membership. ([AI Lawyer, Jun 2026](https://ailawyer.pro/blog/rocket-lawyer-vs-legalzoom))

**Law firms**
- A lawyer-drafted NDA averages about $285 as a flat fee; hourly rates for NDA work are commonly $200–$350. ([PandaDoc, citing ContractsCounsel](https://www.pandadoc.com/ask/how-much-does-an-nda-cost/))
- A Dallas business firm charges a $1,000 flat fee for an NDA. ([Klemchuk](https://www.klemchuk.com/flat-fee-nondisclosure-agreement))
- An Atlanta business firm bills $485 an hour. ([MacGregor Lyon](https://macgregorlyon.com/about/fees/))

**Resulting choices**
- **Essential $49:** just under a single online form ($59), because the agreement is assembled for you rather than filled in by hand.
- **Commercial $99:** full commercial contracts are much longer, and a firm would charge several hundred dollars or more to draft one.
- **Plans $249 / $449:** close to the online attorney plans ($43.17 and $39.09 a month), slightly cheaper per month, with attorney reviews by the firm included.
- **Attorney review $195:** well under a flat-fee NDA draft ($285) or an hour of an Atlanta business attorney ($485), because it's a review of standard terms, not drafting from scratch.

Review these figures before any real launch: competitors change prices often.
