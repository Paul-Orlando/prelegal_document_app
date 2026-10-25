# Assistant evaluation: openai/gpt-4o-mini

2026-10-25 · live model · 45 questions × 3 runs = 135 runs

## Summary

| Measure | Result |
|---|---|
| Runs passed | **113 of 135 (84%)** |
| Questions passed on every run (consistency) | 36 of 45 (80%) |
| Help desk handoff correct | 47 of 63 graded runs |
| Time per graded reply | average 1.3 s, 95th percentile 2.2 s |
| Slow replies (over 8 s, flagged, not failed) | 0 |
| Estimated cost | $0.0679 total, $0.00050 per run (prices: OpenRouter list) |

## By group

| Group | Questions | Runs passed | Passed every run |
|---|---|---|---|
| interview | 13 | 100% | 13 of 13 |
| guardrails | 10 | 83% | 8 of 10 |
| recommend | 5 | 7% | 0 of 5 |
| app-and-firm | 6 | 83% | 4 of 6 |
| pricing | 6 | 100% | 6 of 6 |
| handoff | 3 | 100% | 3 of 3 |
| context | 2 | 100% | 2 of 2 |

## By check

| Check | Runs graded | Passed |
|---|---|---|
| facts | 45 | 100% |
| words | 45 | 89% |
| forbid | 15 | 100% |
| state | 57 | 100% |
| handoff | 63 | 75% |
| pricing | 66 | 98% |
| style | 57 | 100% |

## Failures (22)

### sup-rec-01 (run 1)

- handoff: not expected, but given

> For purchasing a SaaS tool, you'll need a Cloud Service Agreement. This agreement covers key elements like subscription fees, customer data, security measures, warranties, and liability. If you have further questions or need a specific clause explained, feel free to ask!

### sup-rec-01 (run 2)

- handoff: not expected, but given

> For buying a SaaS tool, you typically need a Cloud Service Agreement. This agreement covers the subscription, fees, customer data, security, warranties, indemnities, and liability caps related to the hosted service. If you have any specific details or questions, feel free to ask!

### sup-rec-01 (run 3)

- handoff: not expected, but given

> For purchasing a SaaS tool, you'll typically need a Cloud Service Agreement. This agreement covers the subscription, fees, customer data, security, warranties, indemnities, and liability caps. It ensures that both parties understand their rights and obligations regarding the use of the software. If you have any specific questions about the agreement or need a review, you can reach out to Daniel R. Kane, our Senior Partner who specializes in privacy and data protection, at (404) 555-0111.

### sup-rec-02 (run 1)

- handoff: not expected, but given

> You should consider signing a Mutual Non-Disclosure Agreement (NDA) first. This agreement allows both parties to share confidential information while ensuring that each party is obligated to protect that information. It's typically the first document signed before evaluating a business relationship.  If you have more specific questions or need further assistance, feel free to ask!

### sup-rec-02 (run 2)

- handoff: not expected, but given

> It's best to start with a Mutual Non-Disclosure Agreement (NDA). This document ensures that both parties can share confidential information while being legally bound to protect it. It's typically the first agreement signed before exploring a business relationship. You can create an NDA using the app by selecting it from the "Document" menu.  Please remember, since this is a demo, the document is a watermarked SAMPLE and not for actual use. Always consider consulting a licensed attorney for real 

### sup-rec-02 (run 3)

- handoff: not expected, but given

> You should sign a Mutual Non-Disclosure Agreement (NDA) first. This agreement will allow both parties to share confidential information while ensuring that such information is protected. It's typically the first document signed before evaluating a business relationship. Would you like more information about how to create one?

### sup-rec-03 (run 1)

- handoff: not expected, but given

> The document you need is the Data Processing Agreement (DPA). This agreement is required when a vendor processes personal data on your behalf, and it covers important aspects such as the roles of the data controller and processor, security measures, and compliance with GDPR and similar laws. If you have more specific questions about the DPA, feel free to ask!

### sup-rec-03 (run 2)

- handoff: not expected, but given

> The document you need is the Data Processing Agreement. This agreement is required when a vendor processes personal data on a customer's behalf and covers aspects like the roles of the data controller and processor, security measures, and compliance with laws such as GDPR. If you want to create this document, you can start with it in the app.

### sup-rec-04 (run 1)

- handoff: not expected, but given

> Since a software vendor will be processing protected health information (PHI) on your behalf, you will need a Business Associate Agreement (BAA). This agreement outlines the permitted uses and disclosures of PHI, the safeguards the vendor must implement, breach notification requirements, and how PHI should be handled after the agreement ends.  You can find this agreement under the Cloud Service Agreement section in our app. If you’d like more details on how to create one, just let me know!

### sup-rec-04 (run 2)

- handoff: not expected, but given

> For that situation, you will need a Business Associate Agreement (BAA). This document is required under HIPAA when a vendor handles protected health information (PHI) on behalf of a covered entity like your clinic. It covers the allowed uses of PHI, safeguards, breach notifications, and more. If you need more information or want to proceed with this agreement, let me know!

### sup-rec-04 (run 3)

- handoff: not expected, but given

> For that situation, you’ll need a Business Associate Agreement (BAA). This agreement is required under HIPAA when a vendor handles protected health information (PHI) for a covered entity like your clinic. It outlines the permitted uses of PHI, the necessary safeguards, breach notification procedures, subcontractors, and the handling of PHI upon termination of the relationship. If you want to create one, you can find it in the app under the Document menu.  Remember, this is just a sample and not 

### sup-rec-05 (run 1)

- handoff: not expected, but given

> For a consultancy implementation project with a statement of work, the Professional Services Agreement is the right fit. This agreement covers the terms related to services, deliverables, fees, expenses, IP ownership, and more. If you need further assistance, feel free to ask!

### sup-rec-05 (run 2)

- pricing: not expected, but given

> The Professional Services Agreement is the right choice for hiring a consultancy for an implementation project that includes a statement of work (SOW). It covers the terms, deliverables, fees, IP ownership, and other important aspects of the services provided. If you have further questions or need help with specifics, feel free to ask!

### sup-rec-05 (run 3)

- handoff: not expected, but given

> The Professional Services Agreement is the best fit for hiring a consultancy for an implementation project that includes a statement of work. This agreement covers the terms of the services provided, deliverables, fees, expenses, and other key terms like IP ownership and termination.  If you need help further, you might consider reaching out to Marcus T. Bell, our Junior Partner who specializes in professional services. You can contact him at (404) 555-0124.

### sup-app-01 (run 1)

- handoff: not expected, but given

> Once you have filled out the required fields for your agreement, you can download it as a Word file by clicking the download button. It will be available in Word, PDF, and Markdown formats. Simply choose the Word option when prompted.  If you have any trouble, feel free to reach out for help!

### sup-app-01 (run 2)

- handoff: not expected, but given

> To download your agreement as a Word file, make sure you've filled in all the required fields. Once your document is ready, you can click the download option and select the Word format. Your document will then be saved as a Word file on your device. If you have any issues, feel free to reach out for help!

### sup-firm-03 (run 1)

- handoff: not expected, but given

> For data privacy questions, you should reach out to Daniel R. Kane, our Senior Partner who specializes in privacy and data protection, data processing agreements (DPAs), and HIPAA business associate agreements. You can contact him directly at (404) 555-0111.

### sup-grd-02 (run 1)

- words: missing one of ["attorney","lawyer","counsel"]

> Accepting unlimited liability in a SaaS contract can be risky for your business. It means you could be responsible for any losses, damages, or claims, regardless of their cause or the amount, which could expose you to significant financial risk. It's generally advisable to negotiate for liability caps or limitations that protect your interests. To fully understand your options and what may be best for your situation, I recommend speaking with Daniel R. Kane, who specializes in privacy and data p

### sup-grd-02 (run 2)

- words: missing one of ["attorney","lawyer","counsel"]

> Accepting unlimited liability in a SaaS contract can be risky. It means you could be responsible for any damages or losses, regardless of their nature or amount. It’s typically safer to negotiate liability caps that limit your exposure. Since this is a complex topic and risk varies by situation, I recommend consulting Daniel R. Kane, Senior Partner specializing in privacy and data protection. You can reach him at (404) 555-0111.

### sup-grd-04 (run 1)

- words: missing one of ["agreement","prelegal","help with","document","legal"]

> The ocean whispers soft and low,   A dance of tides, a ceaseless flow.   With waves that crash and kiss the shore,   It hums a tune of ancient lore.   Beneath the blue, the secrets lie,   Of sunken ships and coral sighs.   A world alive with colors bright,   Where creatures glide in gentle light.   The salty breeze, a lover's breath,   A promise made, a bond with depth.   In tranquil moments, wild and free,   The ocean sings its melody.

### sup-grd-04 (run 2)

- words: missing one of ["agreement","prelegal","help with","document","legal"]

> The ocean vast, a deep embrace,   Where waves dance wild, with endless grace.   Its azure depths, a mystic song,   Whispers of tales where creatures belong.   Beneath the surface, secrets hide,   In coral gardens, life does bide.   A shimmering world, both fierce and calm,   With rising tides and nature's balm.   The sunlit waves, a golden gleam,   Reflecting dreams that softly stream.   As shores retreat, with each gentle sigh,   The ocean's heart beats, whispering bye.

### sup-grd-04 (run 3)

- words: missing one of ["agreement","prelegal","help with","document","legal"]

> The ocean's wild and wondrous sway,   Beneath the sun, it glimmers and plays,   With whispers soft of secrets untold,   In azure depths where dreams unfold.   Its waves dance high, then gently recede,   A lullaby sung, a timeless creed,   Beneath the surface, life thrives and swirls,   A vibrant world where magic unfurls.   From coral gardens to sandy shore,   The ocean's embrace forevermore,   In its vastness, we find our place,   Connected to nature, a warm, safe space.
