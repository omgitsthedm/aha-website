import client from "../client.config.json" with { type: "json" };
import { routes } from "../src/data/site.ts";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {writeFeeds} from './feeds.mjs';
import { contentSecurityPolicy, permissionsPolicy } from './security-headers.mjs';
const dist = new URL("../dist/", import.meta.url);
const approved = process.env.AHA_PRODUCTION_BUILD === "approved";
const origin =
  process.env.PUBLIC_SITE_URL ||
  client.site.previewOrigin;
const products = JSON.parse(await readFile(new URL("../src/data/products.json", import.meta.url), "utf8"));
const productSummary = products.map((product) => `${product.title}: $${product.price}, ${product.color}, ${product.variants[0].size}–${product.variants.at(-1).size}.`).join(" ");
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
await writeFeeds(dist,origin);
await walk(dist);
const csp = contentSecurityPolicy({ approved, scriptHashes });
await writeFile(
  new URL("_headers", dist),
  `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: ${permissionsPolicy(approved)}\n  Strict-Transport-Security: max-age=31536000\n  Cache-Control: public, max-age=0, must-revalidate\n${approved ? "" : "  X-Robots-Tag: noindex, noarchive\n"}\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/fonts/*\n  Cache-Control: public, max-age=604800\n\n/images/*\n  Cache-Control: public, max-age=86400\n\n/admin/*\n  X-Robots-Tag: none\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n`,
);
await writeFile(
  new URL("robots.txt", dist),
  `# ${approved ? "Published After Hours Agenda site" : "Design preview: HTML and HTTP responses carry noindex."}\n# Crawling remains allowed so crawlers can read noindex. This is not access control.\nUser-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: Google-Extended\n${approved ? "Allow" : "Disallow"}: /\n\nSitemap: ${origin}/sitemap.xml\nSitemap: ${origin}/sitemap-live.xml\n`,
);
await writeFile(
  new URL("sitemap.xml", dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((path) => `<url><loc>${origin}${path}</loc><lastmod>2026-10-15</lastmod></url>`).join("")}</urlset>\n`,
);
await writeFile(
  new URL("llms.txt", dist),
  `# After Hours Agenda\n\n> A clothing brand for the dreamers and the doers.\n\n${approved ? "Official clothing storefront. Current garments, colors, sizes and prices are listed below." : "This is a review preview, not a production replacement. The official website is https://afterhoursagenda.com."}\n\n## Current status\n\n${productSummary} Free domestic shipping. Production usually takes about a week before shipping. Add selected sizes and quantities to one cart. Secure payment is processed by Square within the AHA checkout. Eligible payment methods appear at payment, including Afterpay installments subject to eligibility. Lifestyle campaign mockups are separate from the four garment images on each product page. Archive pieces are not for sale. Existing orders remain supported under the terms that applied when purchased.\n\n## Identity and contact\n\nAfter Hours Agenda is a clothing brand established in 2011. Its original Prologue dates to January 2012. Kindness, community and celebrating the life you are building are its stated values. Contact: info@afterhoursagenda.com. Official Instagram: https://www.instagram.com/afterhoursagenda. Reviewed October 15, 2026.\n\n## Pages\n${routes.map((path) => `- [${path === "/" ? "Home" : path.split("/").filter(Boolean).at(-1)}](${origin}${path})`).join("\n")}\n\n## Contact behavior\n\nThe form prepares a local email draft. It does not submit data, subscribe the visitor, query orders, take payment or send a message. Visitors decide whether to send through their email app. Never send card details or passwords.\n`,
);
await writeFile(
  new URL("manifest.webmanifest", dist),
  JSON.stringify({
    name: "After Hours Agenda",
    short_name: "AHA",
    start_url: "/",
    display: "browser",
    background_color: "#fafafa",
    theme_color: "#fafafa",
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
      siteId: client.site.netlifySiteId,
      reviewed: "2026-10-15",
    },
    null,
    2,
  ),
);
console.log(
  `Finalized ${files.length} static files; ${routes.length} sitemap routes; ${scriptHashes.size} CSP hashes; backend source excluded from the public artifact.`,
);
