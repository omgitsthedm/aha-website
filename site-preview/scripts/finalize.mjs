import { launch } from "../src/data/catalog.ts";
import { routes, indexableRoutes } from "../src/data/site.ts";
import { readFile, writeFile, readdir, cp, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
const dist = new URL("../dist/", import.meta.url);
const approved = process.env.AHA_PRODUCTION_BUILD === "approved";
const origin =
  process.env.PUBLIC_SITE_URL ||
  "https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app";
if (!approved) {
  await mkdir(new URL("images/", dist), { recursive: true });
  await cp(
    new URL("../review-assets/collection/", import.meta.url),
    new URL("images/collection", dist),
    { recursive: true },
  );
}
const formFields = {
  support: [
    "name",
    "email",
    "reference",
    "topic",
    "message",
    "consent",
    "consent-version",
    "website",
  ],
  newsletter: [
    "email",
    "interest",
    "marketing-consent",
    "consent-version",
    "list",
    "website",
  ],
  returns: [
    "name",
    "email",
    "reference",
    "topic",
    "message",
    "consent",
    "consent-version",
    "website",
  ],
};
const forms = approved
  ? Object.entries(formFields)
      .map(
        ([kind, fields]) =>
          `<form name="aha-${kind}-2026" method="POST" data-netlify="true" netlify-honeypot="website" hidden><input type="hidden" name="form-name" value="aha-${kind}-2026">${fields.map((name) => `<input name="${name}">`).join("")}</form>`,
      )
      .join("")
  : "Review forms do not submit.";
await writeFile(
  new URL("__forms.html", dist),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>After Hours Agenda forms</title></head><body>${forms}</body></html>`,
);
const scriptHashes = new Set();
const files = [];
async function walk(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, dir), path);
    else {
      const buffer = await readFile(new URL(entry.name, dir));
      files.push({
        path,
        bytes: buffer.length,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      });
      if (entry.name.endsWith(".html"))
        for (const match of buffer
          .toString()
          .matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))
          if (match[1])
            scriptHashes.add(
              `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`,
            );
    }
  }
}
await walk(dist);
const paymentsEnabled =
  approved && launch.releaseApproved && launch.policyApproved;
const csp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' ${[...scriptHashes].join(" ")}${paymentsEnabled ? " https://web.squarecdn.com" : ""}`,
  paymentsEnabled
    ? "style-src 'self' 'unsafe-inline' https://web.squarecdn.com"
    : "style-src 'self'",
  "img-src 'self' data:",
  paymentsEnabled
    ? "font-src 'self' https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net"
    : "font-src 'self'",
  paymentsEnabled
    ? "connect-src 'self' https://web.squarecdn.com https://pci-connect.squareup.com https://o160250.ingest.sentry.io"
    : "connect-src 'self'",
  paymentsEnabled ? "frame-src https://web.squarecdn.com" : "frame-src 'none'",
  "worker-src 'none'",
  "upgrade-insecure-requests",
].join("; ");
await writeFile(
  new URL("_headers", dist),
  `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()\n  Strict-Transport-Security: max-age=31536000\n  Cache-Control: public, max-age=0, must-revalidate\n${approved ? "" : "  X-Robots-Tag: noindex, noarchive\n"}\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/fonts/*\n  Cache-Control: public, max-age=604800\n\n/images/*\n  Cache-Control: public, max-age=86400\n`,
);
await writeFile(
  new URL("robots.txt", dist),
  `# ${approved ? "Published After Hours Agenda site" : "Design preview: HTML and HTTP responses carry noindex."}\n# Crawling remains allowed so crawlers can read noindex. This is not access control.\nUser-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: Google-Extended\n${approved ? "Allow" : "Disallow"}: /\n\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  new URL("sitemap.xml", dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${indexableRoutes.map((path) => `<url><loc>${origin}${path}</loc><lastmod>2026-10-09</lastmod></url>`).join("")}</urlset>\n`,
);
await writeFile(
  new URL("llms.txt", dist),
  `# After Hours Agenda\n\n> A clothing brand for the dreamers and the doers.\n\n${approved ? "Official editorial website. New orders are paused." : "This is a review preview, not a production replacement. The official website is https://afterhoursagenda.com."}\n\n## Current status\n\nNew product and gift-card orders are paused while the next collection is developed. No release date is announced here. Lookbook images are labeled campaign concepts, previous-run provider renders or brand archive; they are not available stock. Existing orders remain supported under the terms that applied when purchased.\n\n## Identity and contact\n\nAfter Hours Agenda is a clothing brand established in 2011. Its original Prologue dates to January 2012. Kindness, community and celebrating the life you are building are its stated values. Contact: info@afterhoursagenda.com. Official Instagram: https://www.instagram.com/afterhoursagenda. Reviewed October 9, 2026.\n\n## Pages\n${routes.map((path) => `- [${path === "/" ? "Home" : path.split("/").filter(Boolean).at(-1)}](${origin}${path})`).join("\n")}\n\n## Contact behavior\n\nSupport and returns forms submit requests to the website host in production. Newsletter signup requires separate consent. Order lookup verifies order number, checkout email and shipping postal code. Preview forms and order checks use only test behavior and never access customer records. Saved pieces stay on the visitor device. Optional measurement is off until consent. New purchases stay paused until approved product and fulfillment data are ready. Never send card details or passwords.\n`,
);
await writeFile(
  new URL("manifest.webmanifest", dist),
  JSON.stringify({
    name: "After Hours Agenda",
    short_name: "AHA",
    start_url: "/",
    display: "browser",
    background_color: "#fafafa",
    theme_color: "#ff6b6b",
    icons: [
      {
        src: "/brand/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }),
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
files.length = 0;
await walk(dist);
const digest = createHash("sha256")
  .update(JSON.stringify(files.sort((a, b) => a.path.localeCompare(b.path))))
  .digest("hex");
await writeFile(
  new URL("release.json", dist),
  JSON.stringify(
    {
      project: "After Hours Agenda",
      mode: approved ? "production" : "preview",
      sourceCommit: commit,
      artifactDigest: digest,
      digestScope:
        "All published files except release.json; SHA-256 of path-sorted JSON entries {path,bytes,sha256}.",
      servicesDigest: createHash("sha256")
        .update(
          await readFile(new URL("../.server/legacy.mjs", import.meta.url)),
        )
        .digest("hex"),
      servicesDigestScope:
        "Preserved commerce bundle only; full function archive hashes are recorded in deployment evidence.",
      siteId: "275b4115-16bf-42fb-9b36-6bce9bb93608",
      reviewed: "2026-10-09",
    },
    null,
    2,
  ),
);
console.log(
  `Finalized ${files.length} static files; ${indexableRoutes.length} sitemap routes; ${scriptHashes.size} CSP hashes; guarded services bundled separately.`,
);
