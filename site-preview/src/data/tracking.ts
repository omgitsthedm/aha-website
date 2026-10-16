export const tracking = {
  ga4: 'G-S092LRTVRM',
  metaPixel: '1815233516346046', // Owner accepted terms; dataset verified October 14, 2026.
};

// PostHog: trends on every visit, session replay for a small sample. The
// project key is a public client key; without it PostHog never loads.
const replaySample = Number(import.meta.env.PUBLIC_POSTHOG_REPLAY_SAMPLE ?? '0.2');
export const posthog = {
  key: (import.meta.env.PUBLIC_POSTHOG_KEY ?? '').trim(),
  host: (import.meta.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').trim(),
  replaySample: Number.isFinite(replaySample) ? Math.min(Math.max(replaySample, 0), 1) : 0.2,
};
