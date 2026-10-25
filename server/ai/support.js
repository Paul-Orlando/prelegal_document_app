import Client from 'openai';
import { AI_MODE, MODEL, OPENROUTER_API_KEY, OPENROUTER_BASE_URL } from '../config.js';
import { DOCUMENT_SPECS } from '../documentSpecs.js';
import { FIRM, firmSummary } from '../firm.js';
import { PRICING, pricingSummary } from '../pricing.js';
import { DEMO_MODE } from '../config.js';

/**
 * Help & Support agent. Answers questions about the app, the supported
 * agreements and the firm. When it cannot resolve something it hands the
 * user to the help desk by ending its reply with the [[ESCALATE]] marker,
 * which the server strips and turns into a flag for the UI.
 */

const ESCALATE = '[[ESCALATE]]';
const PRICING_MARK = '[[PRICING]]';

const client =
  AI_MODE === 'openrouter'
    ? new Client({ apiKey: OPENROUTER_API_KEY, baseURL: OPENROUTER_BASE_URL, maxRetries: 1 })
    : null;

export const SUPPORT_SYSTEM = `You are the Help & Support assistant for ${FIRM.product}, a self-serve legal document app run by the law firm ${FIRM.name}.

## This is a demo

${DEMO_MODE ? `Prelegal is currently a demonstration of what an AI legal-document service could look like, not a live legal service. Every download is a watermarked SAMPLE marked not for use. If anyone asks whether they can use, sign or rely on a document, say clearly that they can't: it's a demo sample, not legal advice, and they should speak to a licensed attorney for a real matter. Prices are shown to illustrate the live service; downloads are free in the demo. The firm, attorneys and phone numbers are fictional demo content.` : 'Prelegal is a live service.'}

## What you know

${firmSummary()}

The app builds these agreements from Common Paper's open standard templates:
${DOCUMENT_SPECS.map((s) => `- ${s.name}: ${s.description}`).join('\n')}

Anywhere in the app there is an "Ask Prelegal" chat button (that's you) and a Help & support panel in the top bar with phone numbers, the attorney directory and a callback request form. Users can switch between day and night mode with the sun/moon button in the top bar.

## Pricing and plans

${pricingSummary()}

How the app works: the user picks an agreement from the "Document" menu at the top of the screen. The app then asks one question at a time and fills the answers into the document, shown on the right. The user can preview it any time and download it as Word, PDF or Markdown once required fields are filled. Drafts are saved automatically and listed under "Drafts" in the top bar. Nothing needs an account in this demo.

## How to help

- Only help with Prelegal: choosing and drafting the agreements above, using the app, pricing and plans, and contacting the firm. Be brief and plain-spoken: two to five short sentences.
- Anything else (poems, stories, jokes, code, general knowledge, other legal areas): decline in one sentence and say what you can help with. Never write creative content, even short.
- Agreements are chosen from the Document menu at the top of the screen. Each is its own document; never say one agreement is found inside another.
- You give general information, not legal advice. When someone asks whether a term is right for their situation, or wants a document reviewed or negotiated, explain briefly, then recommend speaking to one of our attorneys, using the word "attorney", and name the one whose focus fits:
  - SaaS, cloud and other commercial or technology contracts, liability and indemnities: ${FIRM.partners[0].name} (${FIRM.partners[0].phone})
  - privacy, data processing (DPA) and HIPAA business associate agreements: ${FIRM.partners[1].name} (${FIRM.partners[1].phone})
  - software licensing, pilots and design partner programs: ${FIRM.partners[2].name} (${FIRM.partners[2].phone})
  - NDAs, partnerships, professional services and startups: ${FIRM.partners[3].name} (${FIRM.partners[3].phone})
  Recommending an attorney is NOT a help desk handoff.

## Help desk handoff (the ${ESCALATE} marker)

Hand off ONLY when you cannot resolve the request yourself:
- billing, payment, refund or account problems
- an error, bug or something in the app not working
- the user asks for a person, or is clearly frustrated
- a question you have no information about above
When you hand off, say so plainly, give the help desk number ${FIRM.helpDesk.display} and email ${FIRM.helpDesk.email} (${FIRM.helpDesk.hours}), and end your reply with ${ESCALATE} on its own line.
Do NOT hand off when you answered the question: recommending an agreement, explaining the app, giving the firm's address or numbers, explaining pricing, or recommending an attorney are all answers, not handoffs. Don't add closing lines like "feel free to reach out" or "contact our help desk if you have more questions".

## Pricing

- Quote only the prices above, exactly. When someone asks which option suits them, compare: single agreements cost the per-agreement price; a plan is better once they'd buy about as many agreements as its break-even figure within its term. If you don't know how many they need, ask.
- When, and only when, your reply states prices, end it with ${PRICING_MARK} on its own line so the app can show a View plans button.
- Signing up happens through a help desk callback; this demo takes no payment.
- Never invent firm details, prices, discounts, deadlines or policies that are not listed above.`;

/* ------------------------------------------------------------ scripted mode */

const usd = (n) => `$${n}`;
const [ESS, COM] = PRICING.tiers;
const [SIX, TWELVE] = PRICING.plans;

const FAQ = [
  {
    match: /\b(can|may|could|should) (i|we) (use|sign|send|rely)|is (this|it) (legal|valid|binding|enforceable)|real (contract|agreement|matter)/i,
    reply:
      'No. Prelegal is a demo, and every download is a watermarked sample marked not for use. Please don\'t sign or rely on it. For a real agreement, speak to a licensed attorney.',
  },
  {
    match: /attorney review|review cost|lawyer review cost/i,
    pricing: true,
    reply: `An attorney review is ${usd(PRICING.attorneyReview.price)} per agreement, or ${usd(PRICING.attorneyReview.memberPrice)} for plan members. The 6-month plan includes 1 review and the 12-month plan includes 3.`,
  },
  {
    match: /price|pricing|cost|how much|plan|subscri|per document|pay\b|fee/i,
    pricing: true,
    reply:
      `Single agreements are ${usd(ESS.price)} (Essential, such as an NDA) or ${usd(COM.price)} (Commercial, such as a Cloud Service Agreement). ` +
      `Plans: ${usd(SIX.price)} for 6 months or ${usd(TWELVE.price)} for 12 months, with unlimited agreements and attorney reviews included. ` +
      `If you expect to need more than a couple of Commercial agreements, a plan usually works out cheaper.`,
  },
  {
    match: /(how|start|use|begin|create|make).*(document|agreement|app|nda|contract)|get started/i,
    reply:
      'Pick an agreement from the Document menu at the top of the screen. I\'ll then ask one question at a time and fill your answers into the document on the right. When the required fields are done, choose a format and press Download.',
  },
  {
    match: /download|pdf|word|docx|export|markdown/i,
    reply:
      'Once every required field is filled, choose Word, PDF or Markdown next to the Download button in the document panel. You can preview the full agreement first with the Preview tab.',
  },
  {
    match: /draft|save|saved|come back|resume|history/i,
    reply:
      'Every answer is saved as you go. Open the Drafts menu in the top bar to pick up any document where you left off.',
  },
  {
    match: /which (one|agreement|document)|what.*(need|should i use)|difference/i,
    reply:
      'Quick guide: a Mutual NDA before you share confidential information; a Cloud Service Agreement to sell or buy SaaS; a DPA when a vendor handles personal data; a Pilot or Design Partner Agreement for early trials; a Professional Services Agreement for consulting work. Tell me a bit about the deal and I can narrow it down.',
  },
  {
    match: /nda|non-?disclosure|confidential/i,
    reply:
      'A Mutual NDA lets both sides share confidential information and obliges both to protect it. It is usually the first thing signed before evaluating a business relationship.',
  },
  {
    match: /lawyer|attorney|partner|review|advice|call|speak|talk/i,
    reply: `For advice on your specific situation, call our main line at ${FIRM.phone.display} or reach a partner directly — for example ${FIRM.partners[0].name} (${FIRM.partners[0].phone}) for SaaS and commercial contracts, or ${FIRM.partners[1].name} (${FIRM.partners[1].phone}) for privacy and data protection.`,
  },
  {
    match: /address|office|where|located|hours|phone|number|contact/i,
    reply: `We're at ${FIRM.address.line1}, ${FIRM.address.city}, ${FIRM.address.region} ${FIRM.address.postal}. Main line ${FIRM.phone.display}, ${FIRM.officeHours}.`,
  },
];

function scriptedReply(text, context = null) {
  if (context?.documentType && /this (question|field)|question i'?m on|what does .*mean/i.test(text)) {
    return {
      text: `You're drafting a ${context.documentType}. The question on screen asks: ${context.question.replace(/\*\*/g, '').slice(0, 300)}\n\nAnswer it in your own words in the main window. If it doesn't apply to your deal, say so there.`,
      escalate: false,
    };
  }
  const hit = FAQ.find((f) => f.match.test(text));
  if (hit) return { text: hit.reply, escalate: false, showPricing: Boolean(hit.pricing) };
  return {
    text: `I don't have an answer for that one. Our help desk can sort it out: call ${FIRM.helpDesk.display} or email ${FIRM.helpDesk.email} (${FIRM.helpDesk.hours}).`,
    escalate: true,
  };
}

/* ----------------------------------------------------------- reply guards */

const HELP_DESK_DIGITS = FIRM.helpDesk.display.replace(/\D/g, '');

/**
 * Read the model's markers, but only trust them when the reply backs them up:
 * the evaluation showed the model adding them to ordinary answers.
 *  - A help desk handoff counts only if the reply gives the help desk's number or email.
 *  - The View plans button shows only if the reply states a price.
 * Markers are always removed from the text the user sees.
 */
export function interpretReply(raw) {
  const text = String(raw ?? '')
    .split(ESCALATE).join('')
    .split(PRICING_MARK).join('')
    .trim();
  const mentionsHelpDesk =
    text.replace(/\D/g, '').includes(HELP_DESK_DIGITS) || text.toLowerCase().includes(FIRM.helpDesk.email.toLowerCase());
  return {
    text,
    escalate: String(raw ?? '').includes(ESCALATE) && mentionsHelpDesk,
    showPricing: String(raw ?? '').includes(PRICING_MARK) && /\$\s?\d/.test(text),
  };
}

/* -------------------------------------------------------------------- main */

/**
 * @param {{role: 'user'|'assistant', content: string}[]} messages  Conversation so far, ending with the user's message.
 * @returns {Promise<{text: string, escalate: boolean}>}
 */
export async function supportReply(messages, context = null) {
  const last = messages[messages.length - 1]?.content ?? '';
  if (!client) return scriptedReply(last, context);

  let system = SUPPORT_SYSTEM;
  if (context?.documentType) {
    system +=
      `\n\n## What the user is doing right now\n\nThey are drafting a ${context.documentType}. ` +
      `The question currently on their screen is:\n<question>${context.question}</question>\n` +
      'If they ask what "this question" or "this field" means, explain that question in plain language and give a typical example answer. ' +
      'Do not fill in the document for them; they answer in the main window.';
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 400,
    });
    const { text, escalate, showPricing } = interpretReply(response.choices[0]?.message?.content ?? '');
    if (!text) return scriptedReply(last, context);
    const usage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      calls: 1,
    };
    return { text, escalate, showPricing, usage };
  } catch (err) {
    console.error('[support] OpenRouter request failed, using scripted answers:', err.message);
    return scriptedReply(last, context);
  }
}
