const approved = process.env.LFNYC_PRODUCTION_BUILD === 'approved';
const preview = 'https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app';
const origin = new URL(process.env.PUBLIC_SITE_URL || preview);
if (
  origin.protocol !== 'https:' ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('PUBLIC_SITE_URL must be an HTTPS origin.');
if (process.env.CONTEXT === 'production' && !approved)
  throw new Error(
    'Production build refused. This is a draft-only LFNYC preview.',
  );
if (!approved && origin.origin !== preview)
  throw new Error('Draft build must use its exact review origin.');
if (approved && origin.origin !== 'https://afterhoursagenda.com')
  throw new Error(
    'The prepared migration supports only the approved existing site. Review other targets separately.',
  );
console.log(
  `Building ${approved ? 'approved production migration' : 'non-transactional preview'} for ${origin.origin}`,
);
