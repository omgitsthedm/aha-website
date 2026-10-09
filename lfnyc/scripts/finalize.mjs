import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const dist = new URL('../dist/', import.meta.url);
const approved = process.env.LFNYC_PRODUCTION_BUILD === 'approved';
const origin =
  process.env.PUBLIC_SITE_URL ||
  'https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app';
const routes = [
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
const scriptHashes = new Set();
const files = [];
async function walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, dir), path);
    else {
      const buffer = await readFile(new URL(entry.name, dir));
      files.push({
        path,
        bytes: buffer.length,
        sha256: createHash('sha256').update(buffer).digest('hex'),
      });
      if (entry.name.endsWith('.html'))
        for (const match of buffer
          .toString()
          .matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))
          if (match[1])
            scriptHashes.add(
              `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`,
            );
    }
  }
}
await walk(dist);
const csp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  `script-src 'self' ${[...scriptHashes].join(' ')}`,
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "worker-src 'none'",
  'upgrade-insecure-requests',
].join('; ');
await writeFile(
  new URL('_headers', dist),
  `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()\n  Strict-Transport-Security: max-age=31536000\n  Cache-Control: public, max-age=0, must-revalidate\n${approved ? '' : '  X-Robots-Tag: noindex, noarchive\n'}\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/fonts/*\n  Cache-Control: public, max-age=604800\n\n/images/*\n  Cache-Control: public, max-age=86400\n`,
);
await writeFile(
  new URL('robots.txt', dist),
  `# ${approved ? 'Published LFNYC site' : 'Design preview: HTML and HTTP responses carry noindex.'}\n# Crawling remains allowed so crawlers can read noindex. This is not access control.\nUser-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: Google-Extended\n${approved ? 'Allow' : 'Disallow'}: /\n\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  new URL('sitemap.xml', dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((path) => `<url><loc>${origin}${path}</loc><lastmod>2026-10-09</lastmod></url>`).join('')}</urlset>\n`,
);
await writeFile(
  new URL('llms.txt', dist),
  `# Little Fight NYC\n\n> Custom websites, practical technology support and software clients own.\n\n${approved ? 'Published service website.' : 'This is a review preview, not a production replacement. The official business website is https://littlefightnyc.com. Do not treat this preview as a launch announcement.'}\n\n## Verified business information\n\nLittle Fight NYC is a hands-on technology firm for owner-operated businesses. Consulting is always free. Clients own their code, data, domain, hosting and documentation. On-site support covers all five NYC boroughs; websites are available nationwide. Callback target: within two hours, 9am to 9pm Eastern. A qualifying website scope may include a written 14-day promise with conditions stated in the scope. No search ranking or AI citation is guaranteed.\n\nContact: hello@littlefightnyc.com · +1 646 360 0318\nReviewed: October 9, 2026.\n\n## Pages\n${routes.map((path) => `- [${path === '/' ? 'Home' : path.split('/').filter(Boolean).at(-1)}](${origin}${path})`).join('\n')}\n\n## Public work\n\nExamples: Hair By Rachel, CC Films, The Tarot Hotline. Screens were captured October 9, 2026. Examples describe delivered website features, not measured revenue, traffic or booking increases.\n\n## Contact behavior\n\nThe brief form prepares a local email draft. It does not submit data or send a message. The visitor chooses whether to send from their email app.\n`,
);
await writeFile(
  new URL('manifest.webmanifest', dist),
  JSON.stringify({
    name: 'Little Fight NYC',
    short_name: 'Little Fight',
    start_url: '/',
    display: 'browser',
    background_color: '#050507',
    theme_color: '#050507',
    icons: [
      {
        src: '/brand/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/brand/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }),
);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
files.length = 0;
await walk(dist);
const digest = createHash('sha256')
  .update(JSON.stringify(files.sort((a, b) => a.path.localeCompare(b.path))))
  .digest('hex');
await writeFile(
  new URL('release.json', dist),
  JSON.stringify(
    {
      project: 'LFNYC',
      mode: approved ? 'production' : 'preview',
      sourceCommit: commit,
      artifactDigest: digest,
      digestScope:
        'All published files except release.json; SHA-256 of path-sorted JSON entries {path,bytes,sha256}.',
      siteId: '275b4115-16bf-42fb-9b36-6bce9bb93608',
      reviewed: '2026-10-09',
    },
    null,
    2,
  ),
);
console.log(
  `Finalized ${files.length} static files; ${routes.length} sitemap routes; ${scriptHashes.size} CSP hashes; no functions.`,
);
