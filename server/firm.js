/**
 * Firm details shown in the Help & Support panel and used by the support agent.
 * Everything here is fictional demo data — swap in real details before launch.
 */
export const FIRM = {
  name: 'Ashford & Kane LLP',
  product: 'Prelegal',
  tagline: 'Standard agreements, drafted in minutes — with real lawyers a call away.',
  address: {
    line1: '1180 West Peachtree Street NW, Suite 2400',
    city: 'Atlanta',
    region: 'GA',
    postal: '30309',
    country: 'United States',
  },
  phone: { display: '(404) 555-0142', tel: '+14045550142' },
  helpDesk: {
    display: '(404) 555-0199',
    tel: '+14045550199',
    email: 'helpdesk@ashfordkane.example',
    hours: 'Monday–Friday, 8:00 am – 7:00 pm ET',
  },
  email: 'counsel@ashfordkane.example',
  officeHours: 'Monday–Friday, 9:00 am – 6:00 pm ET',
  partners: [
    {
      name: 'Margaret A. Ashford',
      role: 'Managing Partner',
      seniority: 'senior',
      focus: 'Commercial and technology contracts, SaaS and cloud agreements',
      phone: '(404) 555-0110',
    },
    {
      name: 'Daniel R. Kane',
      role: 'Senior Partner',
      seniority: 'senior',
      focus: 'Privacy and data protection, DPAs, HIPAA business associate agreements',
      phone: '(404) 555-0111',
    },
    {
      name: 'Priya Natarajan',
      role: 'Junior Partner',
      seniority: 'junior',
      focus: 'Software licensing, pilots and design partner programs',
      phone: '(404) 555-0123',
    },
    {
      name: 'Marcus T. Bell',
      role: 'Junior Partner',
      seniority: 'junior',
      focus: 'Startups, partnerships, NDAs and professional services',
      phone: '(404) 555-0124',
    },
  ],
};

export function firmSummary() {
  const a = FIRM.address;
  return [
    `Firm: ${FIRM.name}, ${a.line1}, ${a.city}, ${a.region} ${a.postal}.`,
    `Main line: ${FIRM.phone.display} (${FIRM.officeHours}). Email: ${FIRM.email}.`,
    `Help desk / customer service: ${FIRM.helpDesk.display}, ${FIRM.helpDesk.email} (${FIRM.helpDesk.hours}).`,
    'Partners:',
    ...FIRM.partners.map((p) => `- ${p.name}, ${p.role} — ${p.focus}. Direct: ${p.phone}.`),
  ].join('\n');
}
