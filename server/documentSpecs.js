/**
 * Field specifications for each supported document type.
 *
 * Common Paper publishes each agreement as non-negotiated *Standard Terms*; the
 * party-specific business details live on a separate Cover Page or Order Form
 * that is NOT published as markdown (only the Mutual NDA repo ships one). So
 * Prelegal authors its own cover page per agreement type.
 *
 * The field lists below are derived from the variables each Standard Terms
 * document actually references — the `coverpage_link` / `orderform_link` /
 * `keyterms_link` spans in the markdown. Those spans are the authoritative list
 * of what each agreement needs filled in.
 */

/** Fields shared by nearly every agreement. */
const governingLaw = [
  {
    key: 'governingLaw',
    label: 'Governing law',
    hint: 'The state or country whose law governs the agreement, e.g. "Delaware".',
    type: 'text',
    required: true,
  },
  {
    key: 'chosenCourts',
    label: 'Chosen courts',
    hint: 'Where disputes are heard, e.g. "the state and federal courts located in New Castle County, Delaware".',
    type: 'text',
    required: true,
  },
];

const liabilityCaps = [
  {
    key: 'generalCapAmount',
    label: 'General cap amount',
    hint: 'The general limit on each party\'s liability, e.g. "1x fees paid in the prior 12 months".',
    type: 'text',
    required: false,
    default: 'Fees paid or payable in the 12 months before the claim',
  },
  {
    key: 'increasedClaims',
    label: 'Increased claims',
    hint: 'Claim types with a higher liability cap. Leave blank for none.',
    type: 'text',
    required: false,
  },
  {
    key: 'increasedCapAmount',
    label: 'Increased cap amount',
    hint: 'The higher cap that applies to Increased Claims. Only needed if you listed Increased Claims.',
    type: 'text',
    required: false,
  },
  {
    key: 'unlimitedClaims',
    label: 'Unlimited claims',
    hint: 'Claim types with no liability cap. Leave blank for none.',
    type: 'text',
    required: false,
  },
];

const indemnities = [
  {
    key: 'providerCoveredClaims',
    label: 'Provider covered claims',
    hint: 'Claims the provider indemnifies against. Leave blank to use the standard defaults.',
    type: 'text',
    required: false,
  },
  {
    key: 'customerCoveredClaims',
    label: 'Customer covered claims',
    hint: 'Claims the customer indemnifies against. Leave blank to use the standard defaults.',
    type: 'text',
    required: false,
  },
];

/**
 * @typedef {object} DocumentSpec
 * @property {string} id            Stable identifier used by the API and the AI.
 * @property {string} name          Human-readable agreement name.
 * @property {string} shortName     Abbreviation used in headings.
 * @property {string} description   What the agreement is for (shown to users and the AI).
 * @property {string[]} aliases     Phrases a user might use to ask for this document.
 * @property {string} standardTerms Filename in templates/ holding the Standard Terms.
 * @property {string} version       Common Paper version of the Standard Terms.
 * @property {string} standardTermsUrl Canonical URL the cover page incorporates by reference.
 * @property {object[]} fields      Fields the cover page needs filled in.
 */

/** @type {DocumentSpec[]} */
export const DOCUMENT_SPECS = [
  {
    id: 'mutual-nda',
    name: 'Mutual Non-Disclosure Agreement',
    shortName: 'MNDA',
    description:
      'A two-way confidentiality agreement. Both sides can share confidential information and both are bound to protect it. Typically the first document signed before evaluating a business relationship.',
    aliases: ['nda', 'mutual nda', 'mnda', 'non-disclosure', 'nondisclosure', 'confidentiality agreement'],
    standardTerms: 'Mutual-NDA.md',
    version: '1.0',
    standardTermsUrl: 'https://commonpaper.com/standards/mutual-nda/1.0',
    fields: [
      {
        key: 'party1',
        label: 'Party 1 name',
        hint: 'Full legal name of the first company, e.g. "Acme Corp., a Delaware corporation".',
        type: 'text',
        required: true,
      },
      {
        key: 'party2',
        label: 'Party 2 name',
        hint: 'Full legal name of the second company.',
        type: 'text',
        required: true,
      },
      {
        key: 'purpose',
        label: 'Purpose',
        hint: 'Why confidential information is being shared.',
        type: 'text',
        required: true,
        default: 'Evaluating whether to enter into a business relationship with the other party.',
      },
      {
        key: 'effectiveDate',
        label: 'Effective date',
        hint: 'The date the agreement starts.',
        type: 'date',
        required: true,
      },
      {
        key: 'termLength',
        label: 'MNDA term',
        hint: 'How long the agreement itself lasts, e.g. "2 years", or "until terminated".',
        type: 'text',
        required: true,
        default: '1 year from the Effective Date',
      },
      {
        key: 'confidentialityTerm',
        label: 'Term of confidentiality',
        hint: 'How long confidential information stays protected, e.g. "3 years", or "in perpetuity".',
        type: 'text',
        required: true,
        default: '1 year from the Effective Date',
      },
      ...governingLaw,
      {
        key: 'party1Notice',
        label: 'Party 1 notice address',
        hint: 'Email or postal address for legal notices to Party 1.',
        type: 'text',
        required: false,
      },
      {
        key: 'party2Notice',
        label: 'Party 2 notice address',
        hint: 'Email or postal address for legal notices to Party 2.',
        type: 'text',
        required: false,
      },
    ],
  },

  {
    id: 'cloud-service-agreement',
    name: 'Cloud Service Agreement',
    shortName: 'CSA',
    description:
      'The main contract for selling or buying a hosted SaaS product. Covers the subscription, fees, customer data, security, warranties, indemnities, and liability caps.',
    aliases: ['csa', 'cloud service', 'saas agreement', 'subscription agreement', 'software as a service'],
    standardTerms: 'CSA.md',
    version: '1.0',
    standardTermsUrl: 'https://commonpaper.com/standards/cloud-service-agreement/1.0',
    fields: [
      {
        key: 'provider',
        label: 'Provider name',
        hint: 'Full legal name of the company providing the cloud service.',
        type: 'text',
        required: true,
      },
      {
        key: 'customer',
        label: 'Customer name',
        hint: 'Full legal name of the company buying the cloud service.',
        type: 'text',
        required: true,
      },
      {
        key: 'effectiveDate',
        label: 'Effective date',
        hint: 'The date the agreement starts.',
        type: 'date',
        required: true,
      },
      {
        key: 'cloudService',
        label: 'Cloud service',
        hint: 'A short description of the product being provided.',
        type: 'text',
        required: true,
      },
      {
        key: 'subscriptionPeriod',
        label: 'Subscription period',
        hint: 'The length of each subscription term, e.g. "12 months".',
        type: 'text',
        required: true,
        default: '12 months',
      },
      {
        key: 'subscriptionFees',
        label: 'Subscription fees',
        hint: 'What the customer pays, e.g. "$2,000 per month".',
        type: 'text',
        required: true,
      },
      {
        key: 'paymentProcess',
        label: 'Payment process',
        hint: 'How and when invoices are paid, e.g. "Net 30 from invoice date".',
        type: 'text',
        required: false,
        default: 'Invoiced annually in advance, due Net 30',
      },
      {
        key: 'nonRenewalNoticeDate',
        label: 'Non-renewal notice date',
        hint: 'How much notice is needed to stop auto-renewal, e.g. "30 days before the end of the Subscription Period".',
        type: 'text',
        required: false,
        default: '30 days before the end of the current Subscription Period',
      },
      {
        key: 'useLimitations',
        label: 'Use limitations',
        hint: 'Limits on how the customer may use the service, e.g. seat or usage caps. Leave blank for none.',
        type: 'text',
        required: false,
      },
      {
        key: 'technicalSupport',
        label: 'Technical support',
        hint: 'What support is included, e.g. "Email support during business hours".',
        type: 'text',
        required: false,
      },
      ...governingLaw,
      ...liabilityCaps,
      ...indemnities,
    ],
  },

  {
    id: 'service-level-agreement',
    name: 'Service Level Agreement',
    shortName: 'SLA',
    description:
      'Uptime and support commitments that attach to a Cloud Service Agreement. Defines target uptime, target support response time, and the service credits owed when they are missed.',
    aliases: ['sla', 'service level', 'uptime agreement', 'uptime commitment'],
    standardTerms: 'sla.md',
    version: '2.0',
    standardTermsUrl: 'https://commonpaper.com/standards/service-level-agreement/2.0',
    fields: [
      {
        key: 'provider',
        label: 'Provider name',
        hint: 'Full legal name of the company providing the service.',
        type: 'text',
        required: true,
      },
      {
        key: 'customer',
        label: 'Customer name',
        hint: 'Full legal name of the customer.',
        type: 'text',
        required: true,
      },
      {
        key: 'targetUptime',
        label: 'Target uptime',
        hint: 'The monthly uptime commitment, e.g. "99.9%".',
        type: 'text',
        required: true,
        default: '99.9%',
      },
      {
        key: 'uptimeCredit',
        label: 'Uptime credit',
        hint: 'The credit owed when uptime is missed, e.g. "5% of monthly fees per 1% below target".',
        type: 'text',
        required: true,
      },
      {
        key: 'supportChannel',
        label: 'Support channel',
        hint: 'Where the customer submits support requests, e.g. "support@provider.com".',
        type: 'text',
        required: true,
      },
      {
        key: 'targetResponseTime',
        label: 'Target response time',
        hint: 'How quickly support requests are acknowledged, e.g. "1 business day".',
        type: 'text',
        required: false,
      },
      {
        key: 'responseTimeCredit',
        label: 'Response time credit',
        hint: 'The credit owed when the response time is missed. Leave blank if none.',
        type: 'text',
        required: false,
      },
      {
        key: 'scheduledDowntime',
        label: 'Scheduled downtime',
        hint: 'Maintenance windows excluded from uptime, e.g. "Sundays 02:00-06:00 UTC, with 48 hours notice".',
        type: 'text',
        required: false,
      },
      {
        key: 'subscriptionPeriod',
        label: 'Subscription period',
        hint: 'The subscription term this SLA covers.',
        type: 'text',
        required: false,
      },
    ],
  },

  {
    id: 'data-processing-agreement',
    name: 'Data Processing Agreement',
    shortName: 'DPA',
    description:
      'Required when a vendor processes personal data on a customer\'s behalf. Covers controller/processor roles, subprocessors, security measures, data subject requests, and international transfers under GDPR and similar laws.',
    aliases: ['dpa', 'data processing', 'gdpr agreement', 'privacy agreement', 'data protection agreement'],
    standardTerms: 'DPA.md',
    version: '1.0',
    standardTermsUrl: 'https://commonpaper.com/standards/data-processing-agreement/1.0',
    fields: [
      {
        key: 'provider',
        label: 'Provider name',
        hint: 'The company processing the personal data (the processor).',
        type: 'text',
        required: true,
      },
      {
        key: 'customer',
        label: 'Customer name',
        hint: 'The company whose data is processed (the controller).',
        type: 'text',
        required: true,
      },
      {
        key: 'agreement',
        label: 'Underlying agreement',
        hint: 'The main contract this DPA attaches to, e.g. "the Cloud Service Agreement dated 1 March 2026".',
        type: 'text',
        required: true,
      },
      {
        key: 'natureAndPurpose',
        label: 'Nature and purpose of processing',
        hint: 'Why the personal data is processed, e.g. "Providing and supporting the hosted analytics platform".',
        type: 'text',
        required: true,
      },
      {
        key: 'categoriesOfPersonalData',
        label: 'Categories of personal data',
        hint: 'What kinds of data are processed, e.g. "Names, email addresses, IP addresses, usage logs".',
        type: 'text',
        required: true,
      },
      {
        key: 'categoriesOfDataSubjects',
        label: 'Categories of data subjects',
        hint: 'Whose data it is, e.g. "Customer\'s employees and end users".',
        type: 'text',
        required: true,
      },
      {
        key: 'durationOfProcessing',
        label: 'Duration of processing',
        hint: 'How long processing continues, e.g. "For the term of the Agreement plus 30 days".',
        type: 'text',
        required: true,
        default: 'For the term of the Agreement, plus any post-termination retention period',
      },
      {
        key: 'specialCategoryData',
        label: 'Special category data',
        hint: 'Sensitive data such as health or biometric data. Enter "None" if not applicable.',
        type: 'text',
        required: false,
        default: 'None',
      },
      {
        key: 'approvedSubprocessors',
        label: 'Approved subprocessors',
        hint: 'Third parties that may process the data, e.g. "Amazon Web Services, Inc.".',
        type: 'text',
        required: false,
      },
      {
        key: 'providerSecurityContact',
        label: 'Provider security contact',
        hint: 'Email address for security and breach notices.',
        type: 'text',
        required: true,
      },
      {
        key: 'securityPolicy',
        label: 'Security policy',
        hint: 'Link to the provider\'s security policy, if any.',
        type: 'text',
        required: false,
      },
      {
        key: 'governingMemberState',
        label: 'Governing member state',
        hint: 'The EU member state whose law governs, if EU transfers are involved. Enter "Not applicable" if none.',
        type: 'text',
        required: false,
        default: 'Not applicable',
      },
      {
        key: 'frequencyOfTransfer',
        label: 'Frequency of transfer',
        hint: 'How often data is transferred, e.g. "Continuous".',
        type: 'text',
        required: false,
        default: 'Continuous',
      },
    ],
  },

  {
    id: 'design-partner-agreement',
    name: 'Design Partner Agreement',
    shortName: 'DPA-Design',
    description:
      'For early-stage collaboration where a partner gets early access to a product still in development in exchange for structured feedback. Covers product access, the feedback program, fees, and confidentiality.',
    aliases: ['design partner', 'design partnership', 'early access agreement', 'beta partner', 'pilot partner'],
    standardTerms: 'design-partner-agreement.md',
    version: '1.0',
    standardTermsUrl: 'https://commonpaper.com/standards/design-partner-agreement/1.0',
    fields: [
      {
        key: 'provider',
        label: 'Provider name',
        hint: 'The company building the product.',
        type: 'text',
        required: true,
      },
      {
        key: 'partner',
        label: 'Partner name',
        hint: 'The company getting early access and giving feedback.',
        type: 'text',
        required: true,
      },
      {
        key: 'effectiveDate',
        label: 'Effective date',
        hint: 'The date the agreement starts.',
        type: 'date',
        required: true,
      },
      {
        key: 'term',
        label: 'Term',
        hint: 'How long the design partnership lasts, e.g. "6 months".',
        type: 'text',
        required: true,
        default: '6 months from the Effective Date',
      },
      {
        key: 'program',
        label: 'Program',
        hint: 'What the partner commits to do, e.g. "Monthly feedback calls and quarterly written product reviews".',
        type: 'text',
        required: true,
      },
      {
        key: 'fees',
        label: 'Fees',
        hint: 'What the partner pays, if anything. Enter "None" for a free program.',
        type: 'text',
        required: false,
        default: 'None',
      },
      ...governingLaw,
      {
        key: 'noticeAddress',
        label: 'Notice addresses',
        hint: 'Email or postal addresses for legal notices to each party.',
        type: 'text',
        required: false,
      },
    ],
  },

  {
    id: 'professional-services-agreement',
    name: 'Professional Services Agreement',
    shortName: 'PSA',
    description:
      'For consulting, implementation, or other services delivered under statements of work. Covers SOW terms, deliverables, fees and expenses, IP ownership, insurance, and termination.',
    aliases: ['psa', 'professional services', 'consulting agreement', 'services agreement', 'sow', 'statement of work'],
    standardTerms: 'psa.md',
    version: '1.0',
    standardTermsUrl: 'https://commonpaper.com/standards/professional-services-agreement/1.0',
    fields: [
      {
        key: 'provider',
        label: 'Provider name',
        hint: 'The company performing the services.',
        type: 'text',
        required: true,
      },
      {
        key: 'customer',
        label: 'Customer name',
        hint: 'The company receiving the services.',
        type: 'text',
        required: true,
      },
      {
        key: 'effectiveDate',
        label: 'Effective date',
        hint: 'The date the agreement starts.',
        type: 'date',
        required: true,
      },
      {
        key: 'services',
        label: 'Services',
        hint: 'A short description of the services to be performed.',
        type: 'text',
        required: true,
      },
      {
        key: 'deliverables',
        label: 'Deliverables',
        hint: 'What the provider will hand over, e.g. "A migration plan and a working staging environment".',
        type: 'text',
        required: true,
      },
      {
        key: 'sowTerm',
        label: 'SOW term',
        hint: 'How long the statement of work runs, e.g. "3 months from the Effective Date".',
        type: 'text',
        required: true,
      },
      {
        key: 'fees',
        label: 'Fees',
        hint: 'What the customer pays, e.g. "$25,000 fixed fee" or "$200 per hour".',
        type: 'text',
        required: true,
      },
      {
        key: 'expenses',
        label: 'Expenses',
        hint: 'How expenses are handled, e.g. "Pre-approved travel expenses reimbursed at cost".',
        type: 'text',
        required: false,
      },
      {
        key: 'insuranceMinimums',
        label: 'Insurance minimums',
        hint: 'Required insurance coverage, if any. Leave blank for none.',
        type: 'text',
        required: false,
      },
      ...governingLaw,
      ...liabilityCaps,
    ],
  },

  {
    id: 'partnership-agreement',
    name: 'Partnership Agreement',
    shortName: 'Partnership',
    description:
      'For commercial partnerships such as reseller, referral, or co-marketing arrangements. Covers partner obligations, fees and commissions, trademark and brand use, and term and termination.',
    aliases: ['partnership', 'reseller agreement', 'referral agreement', 'channel partner', 'co-marketing'],
    standardTerms: 'Partnership-Agreement.md',
    version: '1.0',
    standardTermsUrl: 'https://commonpaper.com/standards/partnership-agreement/1.0',
    fields: [
      {
        key: 'company',
        label: 'Company name',
        hint: 'The company whose product is being partnered on.',
        type: 'text',
        required: true,
      },
      {
        key: 'partner',
        label: 'Partner name',
        hint: 'The partner company (reseller, referrer, or co-marketer).',
        type: 'text',
        required: true,
      },
      {
        key: 'effectiveDate',
        label: 'Effective date',
        hint: 'The date the agreement starts.',
        type: 'date',
        required: true,
      },
      {
        key: 'partnershipType',
        label: 'Partnership type',
        hint: 'The kind of partnership, e.g. "Referral", "Reseller", or "Co-marketing".',
        type: 'text',
        required: true,
      },
      {
        key: 'partnerObligations',
        label: 'Partner obligations',
        hint: 'What the partner commits to do, e.g. "Introduce qualified leads and attend quarterly reviews".',
        type: 'text',
        required: true,
      },
      {
        key: 'fees',
        label: 'Fees or commission',
        hint: 'What the partner earns, e.g. "15% of first-year subscription revenue".',
        type: 'text',
        required: true,
      },
      {
        key: 'term',
        label: 'Term',
        hint: 'How long the partnership lasts, e.g. "12 months, auto-renewing".',
        type: 'text',
        required: true,
        default: '12 months from the Effective Date',
      },
      {
        key: 'brandGuidelines',
        label: 'Brand guidelines',
        hint: 'Link to trademark or brand usage rules, if any.',
        type: 'text',
        required: false,
      },
      ...governingLaw,
      ...liabilityCaps,
    ],
  },

  {
    id: 'business-associate-agreement',
    name: 'Business Associate Agreement',
    shortName: 'BAA',
    description:
      'Required under HIPAA when a vendor handles protected health information (PHI) for a covered entity. Covers permitted uses of PHI, safeguards, breach notification, subcontractors, and return or destruction of PHI.',
    aliases: ['baa', 'business associate', 'hipaa', 'hipaa agreement', 'phi agreement', 'health data agreement'],
    standardTerms: 'BAA.md',
    version: '1.0',
    standardTermsUrl: 'https://commonpaper.com/standards/business-associate-agreement/1.0',
    fields: [
      {
        key: 'company',
        label: 'Covered entity name',
        hint: 'The healthcare organization that owns the protected health information.',
        type: 'text',
        required: true,
      },
      {
        key: 'provider',
        label: 'Business associate name',
        hint: 'The vendor handling protected health information on the covered entity\'s behalf.',
        type: 'text',
        required: true,
      },
      {
        key: 'baaEffectiveDate',
        label: 'BAA effective date',
        hint: 'The date this BAA starts.',
        type: 'date',
        required: true,
      },
      {
        key: 'agreement',
        label: 'Underlying agreement',
        hint: 'The main contract this BAA attaches to, e.g. "the Cloud Service Agreement dated 1 March 2026".',
        type: 'text',
        required: true,
      },
      {
        key: 'breachNotificationPeriod',
        label: 'Breach notification period',
        hint: 'How quickly a breach must be reported, e.g. "5 business days after discovery".',
        type: 'text',
        required: true,
        default: '5 business days after discovery',
      },
      {
        key: 'limitations',
        label: 'Limitations',
        hint: 'Any extra limits on how PHI may be used or disclosed. Leave blank for none.',
        type: 'text',
        required: false,
      },
    ],
  },

  {
    id: 'software-license-agreement',
    name: 'Software License Agreement',
    shortName: 'SLA-License',
    description:
      'For licensing self-hosted or downloadable software (as opposed to a hosted service). Covers the license grant and restrictions, delivery, support, fees, IP ownership, warranties, and liability.',
    aliases: [
      'software license',
      'license agreement',
      'eula',
      'end user license',
      'on-premise license',
      'self-hosted license',
    ],
    standardTerms: 'Software-License-Agreement.md',
    version: '1.0',
    standardTermsUrl: 'https://commonpaper.com/standards/software-license-agreement/1.0',
    fields: [
      {
        key: 'provider',
        label: 'Provider name',
        hint: 'The company licensing out the software.',
        type: 'text',
        required: true,
      },
      {
        key: 'customer',
        label: 'Customer name',
        hint: 'The company licensing the software.',
        type: 'text',
        required: true,
      },
      {
        key: 'effectiveDate',
        label: 'Effective date',
        hint: 'The date the agreement starts.',
        type: 'date',
        required: true,
      },
      {
        key: 'software',
        label: 'Software',
        hint: 'A short description of the software being licensed.',
        type: 'text',
        required: true,
      },
      {
        key: 'permittedUses',
        label: 'Permitted uses',
        hint: 'What the customer may do with the software, e.g. "Internal business use only".',
        type: 'text',
        required: true,
        default: 'Internal business use only',
      },
      {
        key: 'licenseLimits',
        label: 'License limits',
        hint: 'Quantity limits, e.g. "Up to 50 named users across 2 production environments".',
        type: 'text',
        required: true,
      },
      {
        key: 'subscriptionPeriod',
        label: 'Subscription period',
        hint: 'The length of each license term, e.g. "12 months".',
        type: 'text',
        required: true,
        default: '12 months',
      },
      {
        key: 'fees',
        label: 'License fees',
        hint: 'What the customer pays, e.g. "$40,000 per year".',
        type: 'text',
        required: true,
      },
      {
        key: 'paymentProcess',
        label: 'Payment process',
        hint: 'How and when invoices are paid.',
        type: 'text',
        required: false,
        default: 'Invoiced annually in advance, due Net 30',
      },
      {
        key: 'warrantyPeriod',
        label: 'Warranty period',
        hint: 'How long the software warranty lasts, e.g. "90 days from delivery".',
        type: 'text',
        required: false,
        default: '90 days from delivery',
      },
      {
        key: 'deletionProcedure',
        label: 'Deletion procedure',
        hint: 'What the customer must do with the software at the end of the term.',
        type: 'text',
        required: false,
        default: 'Delete all copies and certify deletion in writing within 30 days',
      },
      ...governingLaw,
      ...liabilityCaps,
      ...indemnities,
    ],
  },

  {
    id: 'pilot-agreement',
    name: 'Pilot Agreement',
    shortName: 'Pilot',
    description:
      'A short-term trial or evaluation contract that lets a prospective customer test a product before committing to a full deal. Simpler terms, limited scope, easy to terminate.',
    aliases: ['pilot', 'trial agreement', 'evaluation agreement', 'poc', 'proof of concept', 'trial'],
    standardTerms: 'Pilot-Agreement.md',
    version: '1.1',
    standardTermsUrl: 'https://commonpaper.com/standards/pilot-agreement/1.1',
    fields: [
      {
        key: 'provider',
        label: 'Provider name',
        hint: 'The company offering the pilot.',
        type: 'text',
        required: true,
      },
      {
        key: 'customer',
        label: 'Customer name',
        hint: 'The company running the pilot.',
        type: 'text',
        required: true,
      },
      {
        key: 'effectiveDate',
        label: 'Effective date',
        hint: 'The date the pilot starts.',
        type: 'date',
        required: true,
      },
      {
        key: 'product',
        label: 'Product',
        hint: 'A short description of the product being piloted.',
        type: 'text',
        required: true,
      },
      {
        key: 'pilotPeriod',
        label: 'Pilot period',
        hint: 'How long the pilot runs, e.g. "60 days from the Effective Date".',
        type: 'text',
        required: true,
        default: '60 days from the Effective Date',
      },
      {
        key: 'fees',
        label: 'Fees',
        hint: 'What the customer pays for the pilot. Enter "None" for a free pilot.',
        type: 'text',
        required: false,
        default: 'None',
      },
      {
        key: 'generalCapAmount',
        label: 'General cap amount',
        hint: 'The limit on each party\'s liability during the pilot.',
        type: 'text',
        required: false,
        default: 'Fees paid under this Agreement, or $1,000 if the pilot is free',
      },
      ...governingLaw,
      {
        key: 'noticeAddress',
        label: 'Notice addresses',
        hint: 'Email or postal addresses for legal notices to each party.',
        type: 'text',
        required: false,
      },
    ],
  },

  {
    id: 'ai-addendum',
    name: 'AI Addendum',
    shortName: 'AI Addendum',
    description:
      'Attaches to an existing agreement when the product includes AI features. Covers AI inputs and outputs, whether customer data may be used for model training, ownership of outputs, and accuracy disclaimers.',
    aliases: ['ai addendum', 'ai terms', 'artificial intelligence addendum', 'llm addendum', 'ai rider'],
    standardTerms: 'AI-Addendum.md',
    version: '1.0',
    standardTermsUrl: 'https://commonpaper.com/standards/ai-addendum/1.0',
    fields: [
      {
        key: 'provider',
        label: 'Provider name',
        hint: 'The company providing the AI features.',
        type: 'text',
        required: true,
      },
      {
        key: 'customer',
        label: 'Customer name',
        hint: 'The company using the AI features.',
        type: 'text',
        required: true,
      },
      {
        key: 'agreement',
        label: 'Underlying agreement',
        hint: 'The main contract this addendum attaches to, e.g. "the Cloud Service Agreement dated 1 March 2026".',
        type: 'text',
        required: true,
      },
      {
        key: 'trainingData',
        label: 'Training data',
        hint: 'What data (if any) the provider may use to train models. Enter "None" to prohibit training entirely — that is the default if left blank.',
        type: 'text',
        required: false,
        default: 'None — Provider may not use Customer Inputs or Outputs to train any Model',
      },
      {
        key: 'trainingPurposes',
        label: 'Training purposes',
        hint: 'What the provider may train for. Only needed if training data is permitted.',
        type: 'text',
        required: false,
      },
      {
        key: 'trainingRestrictions',
        label: 'Training restrictions',
        hint: 'Limits on permitted training, e.g. "Aggregated and de-identified data only".',
        type: 'text',
        required: false,
      },
      {
        key: 'improvementRestrictions',
        label: 'Improvement restrictions',
        hint: 'Limits on using data to improve the AI system without training, e.g. "No human review of Customer Inputs".',
        type: 'text',
        required: false,
      },
    ],
  },
];

const byId = new Map(DOCUMENT_SPECS.map((spec) => [spec.id, spec]));

/** @returns {DocumentSpec | undefined} */
export function getSpec(id) {
  return byId.get(id);
}

export function listSpecs() {
  return DOCUMENT_SPECS.map(({ id, name, shortName, description, aliases, version }) => ({
    id,
    name,
    shortName,
    description,
    aliases,
    version,
  }));
}

/** Required field keys that are still missing or blank in `values`. */
export function missingRequiredFields(spec, values = {}) {
  return spec.fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = values[f.key];
      return v === undefined || v === null || String(v).trim() === '';
    })
    .map((f) => f.key);
}

/** Every field key defined across all specs — used to validate AI tool input. */
export function isKnownField(specId, key) {
  const spec = byId.get(specId);
  return Boolean(spec && spec.fields.some((f) => f.key === key));
}

/**
 * Best-effort match of a free-text document request to a supported spec.
 * Returns the matching spec, or null when nothing matches confidently.
 */
export function matchSpec(text) {
  if (!text) return null;
  const q = String(text).toLowerCase().trim();
  if (byId.has(q)) return byId.get(q);

  for (const spec of DOCUMENT_SPECS) {
    if (spec.name.toLowerCase() === q) return spec;
    if (spec.aliases.includes(q)) return spec;
  }
  // Substring pass: longest alias wins so "software license" beats "license".
  let best = null;
  let bestLen = 0;
  for (const spec of DOCUMENT_SPECS) {
    for (const alias of [spec.name.toLowerCase(), ...spec.aliases]) {
      if (q.includes(alias) && alias.length > bestLen) {
        best = spec;
        bestLen = alias.length;
      }
    }
  }
  return best;
}
