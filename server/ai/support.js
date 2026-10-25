import Client from 'openai';
import { AI_MODE, MODEL, OPENROUTER_API_KEY } from '../config.js';
import { DOCUMENT_SPECS } from '../documentSpecs.js';
import { FIRM, firmSummary } from '../firm.js';

/**
 * Help & Support agent. Answers questions about the app, the supported
 * agreements and the firm. When it cannot resolve something it hands the
 * user to the help desk by ending its reply with the [[ESCALATE]] marker,
 * which the server strips and turns into a flag for the UI.
 */

const ESCALATE = '[[ESCALATE]]';

const client =
  AI_MODE === 'openrouter'
    ? new Client({ apiKey: OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' })
    : null;

const SYSTEM = `You are the Help & Support assistant for ${FIRM.product}, a self-serve legal document app run by the law firm ${FIRM.name}.

## What you know

${firmSummary()}

The app builds these agreements from Common Paper's open standard templates:
${DOCUMENT_SPECS.map((s) => `- ${s.name}: ${s.description}`).join('\n')}

How the app works: the user picks an agreement from the "Document" menu at the top of the screen. The app then asks one question at a time and fills the answers into the document, shown on the right. The user can preview it any time and download it as Word, PDF or Markdown once required fields are filled. Drafts are saved automatically and listed under "Drafts" in the top bar. Nothing needs an account in this demo.

## How to help

- Answer questions about using the app, what each agreement is for, which one fits a situation, and what a common clause or field means. Be brief and plain-spoken: two to five short sentences.
- You give general information, not legal advice. If someone asks whether a term is right for their specific situation, or needs a document reviewed, negotiated or customised, suggest a call with the partner whose focus fits, by name and direct number.
- If you cannot answer — account or billing issues, a bug or error in the app, anything outside the information above, or the user is frustrated or asks for a person — say so plainly, point them to the help desk at ${FIRM.helpDesk.display} or ${FIRM.helpDesk.email} (${FIRM.helpDesk.hours}), and end your reply with the exact marker ${ESCALATE} on its own line.
- Never invent firm details, prices, deadlines or policies that are not listed above.`;

/* ------------------------------------------------------------ scripted mode */

const FAQ = [
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

function scriptedReply(text) {
  const hit = FAQ.find((f) => f.match.test(text));
  if (hit) return { text: hit.reply, escalate: false };
  return {
    text: `I don't have an answer for that one. Our help desk can sort it out: call ${FIRM.helpDesk.display} or email ${FIRM.helpDesk.email} (${FIRM.helpDesk.hours}).`,
    escalate: true,
  };
}

/* -------------------------------------------------------------------- main */

/**
 * @param {{role: 'user'|'assistant', content: string}[]} messages  Conversation so far, ending with the user's message.
 * @returns {Promise<{text: string, escalate: boolean}>}
 */
export async function supportReply(messages) {
  const last = messages[messages.length - 1]?.content ?? '';
  if (!client) return scriptedReply(last);

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM }, ...messages],
      max_tokens: 400,
    });
    let text = (response.choices[0]?.message?.content ?? '').trim();
    const escalate = text.includes(ESCALATE);
    text = text.replace(ESCALATE, '').trim();
    if (!text) return scriptedReply(last);
    return { text, escalate };
  } catch (err) {
    console.error('[support] OpenRouter request failed, using scripted answers:', err.message);
    return scriptedReply(last);
  }
}
