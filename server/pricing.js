import { DOCUMENT_SPECS, getSpec } from './documentSpecs.js';
import { FIRM } from './firm.js';

/**
 * Prices and plans. Shown on the Pricing page and used by the Ask Prelegal
 * assistant. Demo prices: no payment is taken in this app.
 *
 * Benchmarks they were set against (see docs/PRICING.md for sources):
 *  - online legal-form services: about $59 per form; attorney plans about
 *    $39–43 a month, or $149–$469 a year
 *  - a lawyer-drafted NDA: about $285 flat on average; Atlanta business
 *    attorneys bill around $485 an hour
 * Prelegal sits between the two: firm-backed standard terms, assembled by the
 * interview, with attorney review available.
 */

export const PRICING = {
  currency: 'USD',
  demoNote: 'Demo pricing. No payment is taken in this demo.',

  // One-to-one: pay once per finished agreement.
  tiers: [
    {
      id: 'essential',
      name: 'Essential',
      price: 49,
      blurb: 'Shorter agreements with a few key terms.',
      specs: ['mutual-nda', 'pilot-agreement', 'ai-addendum', 'service-level-agreement', 'design-partner-agreement'],
    },
    {
      id: 'commercial',
      name: 'Commercial',
      price: 99,
      blurb: 'Full commercial contracts with liability, data and payment terms.',
      specs: [
        'cloud-service-agreement',
        'professional-services-agreement',
        'data-processing-agreement',
        'business-associate-agreement',
        'software-license-agreement',
        'partnership-agreement',
      ],
    },
  ],
  singleIncludes: [
    'The finished agreement in Word, PDF and Markdown',
    'Edits and re-downloads of that agreement for 30 days',
    'Ask Prelegal and help desk support',
  ],

  // Subscriptions: paid upfront for the term; they don't renew automatically.
  plans: [
    {
      id: 'six-month',
      name: '6-month plan',
      months: 6,
      price: 249,
      includes: [
        'Unlimited agreements, all 11 types',
        'Word, PDF and Markdown downloads',
        'Drafts saved for the whole term',
        '1 attorney review included',
        'Attorney reviews after that at the member rate',
      ],
    },
    {
      id: 'twelve-month',
      name: '12-month plan',
      months: 12,
      price: 449,
      badge: 'Best value',
      includes: [
        'Unlimited agreements, all 11 types',
        'Word, PDF and Markdown downloads',
        'Drafts saved for the whole term',
        '3 attorney reviews included',
        'Priority help desk callbacks',
        'Attorney reviews after that at the member rate',
      ],
    },
  ],
  planTerms: 'Plans are paid upfront for the full term and do not renew automatically.',

  attorneyReview: {
    price: 195,
    memberPrice: 150,
    detail: `One of our attorneys reviews your finished agreement and calls you to go through it, within 2 business days.`,
  },

  comparison:
    'For comparison, a lawyer-drafted NDA typically costs around $285 as a flat fee, and Atlanta business attorneys commonly bill several hundred dollars an hour.',
};

/** The single-document price and tier for an agreement. */
export function priceFor(specId) {
  const tier = PRICING.tiers.find((t) => t.specs.includes(specId));
  return tier ? { tier: tier.id, tierName: tier.name, price: tier.price } : null;
}

/** Monthly equivalent of a plan, rounded to cents. */
export function perMonth(plan) {
  return Math.round((plan.price / plan.months) * 100) / 100;
}

/** How many single documents of a tier a plan costs the same as (rounded up). */
export function breakEven(plan, tierId) {
  const tier = PRICING.tiers.find((t) => t.id === tierId);
  return Math.ceil(plan.price / tier.price);
}

/** Everything the Pricing page needs, with derived numbers computed here, not by hand. */
export function pricingView() {
  return {
    ...PRICING,
    tiers: PRICING.tiers.map((t) => ({
      ...t,
      agreements: t.specs.map((id) => ({ id, name: getSpec(id).name })),
    })),
    plans: PRICING.plans.map((p) => ({
      ...p,
      perMonth: perMonth(p),
      breakEven: { essential: breakEven(p, 'essential'), commercial: breakEven(p, 'commercial') },
    })),
  };
}

/**
 * The cheapest way to pay for a number of agreements over a period: one at a
 * time, or enough plans to cover the period. Used by the Pricing page estimator.
 * @param {{essential: number, commercial: number, months: 6|12}} input
 */
export function cheapestOption({ essential = 0, commercial = 0, months = 12 }) {
  const e = Math.max(0, Math.min(500, Math.floor(Number(essential) || 0)));
  const c = Math.max(0, Math.min(500, Math.floor(Number(commercial) || 0)));
  const m = Number(months) === 6 ? 6 : 12;
  const [ess, com] = PRICING.tiers;
  const options = [
    { id: 'single', label: 'One at a time', cost: e * ess.price + c * com.price },
    ...PRICING.plans.map((p) => {
      const count = Math.ceil(m / p.months);
      return { id: p.id, label: count > 1 ? `${count} × ${p.name}` : p.name, cost: count * p.price };
    }),
  ];
  const best = options.reduce((a, b) => (b.cost < a.cost ? b : a));
  const single = options[0].cost;
  return { essential: e, commercial: c, months: m, options, best: best.id, saving: Math.max(0, single - best.cost) };
}

const usd = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** Plain-text summary for the support assistant's system prompt. */
export function pricingSummary() {
  const lines = [`${PRICING.demoNote}`, '', 'Single agreements (pay once per agreement):'];
  for (const t of PRICING.tiers) {
    lines.push(`- ${t.name}, ${usd(t.price)} each: ${t.specs.map((id) => getSpec(id).name).join(', ')}.`);
  }
  lines.push(`  Each includes: ${PRICING.singleIncludes.join('; ')}.`);
  lines.push('', 'Subscription plans:');
  for (const p of PRICING.plans) {
    lines.push(
      `- ${p.name}: ${usd(p.price)} for ${p.months} months (about ${usd(perMonth(p))} a month). ` +
        `Includes: ${p.includes.join('; ')}. Costs the same as ${breakEven(p, 'commercial')} Commercial or ` +
        `${breakEven(p, 'essential')} Essential agreements bought one at a time.`,
    );
  }
  lines.push(`  ${PRICING.planTerms}`);
  lines.push(
    '',
    `Attorney review: ${usd(PRICING.attorneyReview.price)} per agreement, ${usd(PRICING.attorneyReview.memberPrice)} for plan members. ${PRICING.attorneyReview.detail}`,
    `To sign up for a plan or book a review, the user requests a callback from the help desk (${FIRM.helpDesk.display}).`,
  );
  return lines.join('\n');
}

// Every supported agreement must have exactly one price.
for (const spec of DOCUMENT_SPECS) {
  const n = PRICING.tiers.filter((t) => t.specs.includes(spec.id)).length;
  if (n !== 1) throw new Error(`Pricing: ${spec.id} is in ${n} tiers; it must be in exactly one.`);
}
