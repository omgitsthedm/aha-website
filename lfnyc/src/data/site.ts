export const brand = {
  name: 'Little Fight NYC',
  email: 'hello@littlefightnyc.com',
  phone: '(646) 360-0318',
  tel: '+16463600318',
  official: 'https://littlefightnyc.com',
  verified: '2026-10-09',
};

export const services = [
  {
    slug: 'websites',
    number: '01',
    name: 'Custom websites',
    short: 'Be found. Be chosen.',
    title: 'A website that earns its place.',
    description:
      'A custom website that helps people understand your business and take the next step. Built for phones, search, and the way your customers choose.',
    eyebrow: 'Your next customer starts here',
    lead: 'Your business has its own way of doing things. Your website should show it.',
    image: 'storefront-beauty-supply.webp',
    alt: 'A neighborhood beauty supply storefront from the LFNYC brand image library.',
    items: [
      'Clear pages for the services people actually ask about.',
      'Booking, calls and inquiries with a direct route from every page.',
      'A fast, readable website you can use on a phone.',
      'Your code, domain, hosting and written handoff stay yours.',
    ],
    process: [
      'We look at what you have and what customers need.',
      'You review a working site with your content and real customer paths.',
      'We test, explain the controls, and launch when you approve.',
    ],
    cta: 'Plan my website',
  },
  {
    slug: 'tech-support',
    number: '02',
    name: 'Tech support',
    short: 'Keep the day moving.',
    title: 'Let’s get you back to work.',
    description:
      'Hands-on help with computers, Wi-Fi, email, devices and the technology your business uses every day. Remote help and on-site support across New York City.',
    eyebrow: 'Something stopped working',
    lead: 'Tell us what happened. We will work out the next useful step with you.',
    image: 'counter-pos.webp',
    alt: 'A card reader and tip jar on a small business counter.',
    items: [
      'Troubleshoot unreliable Wi-Fi and connected devices.',
      'Untangle business email, account access and shared files.',
      'Set up computers, printers and the tools behind your counter.',
      'Explain what changed and leave clear instructions.',
    ],
    process: [
      'Call or write with the problem and what changed recently.',
      'We diagnose before recommending a repair or replacement.',
      'You approve paid work before it begins.',
    ],
    cta: 'Get tech help',
  },
  {
    slug: 'business-systems',
    number: '03',
    name: 'Software you own',
    short: 'Make the work fit.',
    title: 'Your process. Your own tool.',
    description:
      'Focused custom software for repeated work, approvals and business operations. Start with the task that wastes time and build a tool your business controls.',
    eyebrow: 'When another subscription will not do',
    lead: 'If the same workaround keeps coming back, it may deserve a better tool.',
    image: 'retail-rack.webp',
    alt: 'Clothing arranged on a retail rack in the LFNYC brand image library.',
    items: [
      'Connect useful tools so information does not need entering twice.',
      'Give approvals, requests and handoffs a clear home.',
      'Build a focused first version around a real daily task.',
      'Keep ownership of the code, data, hosting and documentation.',
    ],
    process: [
      'We map the task with the people who do it.',
      'We build a small working proof before expanding the scope.',
      'We test it with real workflows and hand over the controls.',
    ],
    cta: 'Talk through my workflow',
  },
] as const;

export const work = [
  {
    name: 'Hair By Rachel',
    kind: 'Salon · Website & booking',
    image: 'work-hair-by-rachel.webp',
    description:
      'Service guidance and a Hair Brief help new clients find their next step before the Square booking handoff.',
    href: 'https://hairbyrachelcharles.com',
    story: 'https://littlefightnyc.com/case-studies/hair-by-rachel-charles/',
  },
  {
    name: 'CC Films',
    kind: 'Film · Website & premiere archive',
    image: 'work-cc-films.webp',
    description:
      'The film, trailer, credits and premiere photos have one official home with clear paths for fans and press.',
    href: 'https://ccfilms.net',
    story: 'https://littlefightnyc.com/case-studies/cc-films/',
  },
  {
    name: 'The Tarot Hotline',
    kind: 'Personal services · Website',
    image: 'work-tarot-hotline.webp',
    description:
      'Reading formats are explained before visitors choose a voice note, live conversation or booking path.',
    href: 'https://thetarothotline.com',
    story: 'https://littlefightnyc.com/case-studies/the-tarot-hotline/',
  },
] as const;

export const answers = [
  {
    q: 'What does Little Fight NYC do?',
    a: 'We build custom websites, fix everyday business technology, and create focused software that clients own. We work with independent, owner-operated businesses.',
  },
  {
    q: 'Is the first conversation free?',
    a: 'Yes. Consulting is always free. We look at what you have, explain the next move, and agree any paid scope before work begins.',
  },
  {
    q: 'Do I need to replace my existing website?',
    a: 'That depends on what is getting in the way. We start by checking the current site, customer paths and business needs. Useful tools stay useful; a full rebuild is not the automatic answer.',
  },
  {
    q: 'Can you work with my booking or payment system?',
    a: 'Yes. We start with the tools your business already uses. We check the available integration and account access before agreeing the work.',
  },
  {
    q: 'Who owns the website and accounts?',
    a: 'You do. Your code, domain, business data, hosting and documentation stay yours. Ownership is part of the handoff, not a later upgrade.',
  },
  {
    q: 'Where do you work?',
    a: 'On-site technology support covers all five New York City boroughs. Website projects are available nationwide, with remote conversations and review.',
  },
  {
    q: 'How quickly can I get help?',
    a: 'Our callback target is within two hours, 9am to 9pm Eastern Time. After hours, leave a message. A callback target is not a guaranteed repair time.',
  },
  {
    q: 'Does every website take 14 days?',
    a: 'No. A qualifying website scope may include the written 14-day promise. The scope states eligibility, when the clock starts, what each side supplies, and the remedy if qualifying work is late.',
  },
  {
    q: 'Can you guarantee search rankings or AI mentions?',
    a: 'No. We can improve the website’s content, structure and technical quality. Search engines and AI services decide what they show; no placement is guaranteed.',
  },
] as const;

export const routes = [
  '/',
  '/services/websites/',
  '/services/tech-support/',
  '/services/business-systems/',
  '/work/',
  '/about/',
  '/contact/',
  '/answers/',
  '/privacy/',
  '/terms/',
  '/accessibility/',
];
