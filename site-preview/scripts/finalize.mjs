import client from "../client.config.json" with { type: "json" };
import { moved, routes } from "../src/data/site.ts";
import { onSale } from "../server/catalog/off-sale.mjs";
import { appendFile, readFile, writeFile, readdir } from "node:fs/promises";
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
// The date of the commit being built: the same on every machine, so sitemap dates,
// llms.txt and release.json stay current without making builds differ.
const builtOn = execFileSync("git", ["log", "-1", "--format=%cs"], { encoding: "utf8" }).trim();
const builtOnWords = new Date(`${builtOn}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
// Products off sale (src/data/off-sale.json) aren't listed as current.
const productSummary = onSale(products).map((product) => `${product.title}: $${product.price}, ${product.color}, ${product.variants[0].size}–${product.variants.at(-1).size}.`).join(" ");
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
          .matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))
          // JSON data blocks do not execute and are not checked by script-src.
          // Hashing each product's data inflated every asset response header.
          if (match[2] && !/\btype\s*=\s*(["'])application\/(?:ld\+)?json\1/i.test(match[1]))
            scriptHashes.add(
              `'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`,
            );
    }
  }
}
await writeFeeds(dist,origin);
await walk(dist);
const csp = contentSecurityPolicy({ approved, scriptHashes });
await writeFile(
  new URL("_headers", dist),
  `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: ${permissionsPolicy(approved)}\n  Strict-Transport-Security: max-age=31536000\n  Cache-Control: public, max-age=0, must-revalidate\n${approved ? "" : "  X-Robots-Tag: noindex, noarchive\n"}\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/fonts/*\n  Cache-Control: public, max-age=604800\n\n/images/*\n  Cache-Control: public, max-age=86400\n\n/images/immutable/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/motion/*\n  Cache-Control: public, max-age=86400\n\n/admin/*\n  X-Robots-Tag: none\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n\n/order/*\n  X-Robots-Tag: none\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n\n/account/*\n  X-Robots-Tag: none\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n\n/unsubscribe/*\n  X-Robots-Tag: none\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n`,
);
// Moved pages, with and without the trailing slash, after the feed rewrites writeFeeds() wrote.
await appendFile(
  new URL("_redirects", dist),
  moved.flatMap(([from, to]) => [`${from.replace(/\/$/, "")} ${to} 301`, `${from} ${to} 301`]).join("\n") + "\n",
);
await writeFile(
  new URL("robots.txt", dist),
  `# ${approved ? "After Hours Agenda" : "Design preview: HTML and HTTP responses carry noindex."}\n# Search and shopping crawlers are welcome. AI training crawlers are not.\nUser-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: Claude-SearchBot\nAllow: /\n\nUser-agent: Claude-User\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: Google-Extended\n${approved ? "Allow" : "Disallow"}: /\n\nSitemap: ${origin}/sitemap.xml\nSitemap: ${origin}/sitemap-live.xml\n`,
);
await writeFile(
  new URL("sitemap.xml", dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((path) => `<url><loc>${origin}${path}</loc><lastmod>${builtOn}</lastmod></url>`).join("")}</urlset>\n`,
);
await writeFile(
  new URL("llms.txt", dist),
  `# After Hours Agenda\n\n> Graphic tees, soft fleece and ribbed knitwear.\n\n${approved ? "Official clothing storefront. Current garments, colors, sizes and prices are listed below." : "This is a review preview, not a production replacement. The official website is https://afterhoursagenda.com."}\n\n## Current status\n\n${productSummary} Free domestic shipping. Production usually takes about a week before shipping. Add selected sizes and quantities to one cart. Secure payment is processed by Square within the AHA checkout. Eligible payment methods appear at payment, including Afterpay installments subject to eligibility. Lifestyle campaign mockups are separate from the four garment images on each product page. Archive pieces are not for sale. Existing orders remain supported under the terms that applied when purchased.\n\n## Identity and contact\n\nAfter Hours Agenda is David Marsh's clothing brand from Phoenix, Arizona, established in 2011. Its original Prologue dates to January 2012. Pieces are made to order in the United States; each product page identifies its garment and whether it is printed or embroidered. Kindness, community and celebrating the life you are building are its stated values. Contact: info@afterhoursagenda.com. Official Instagram: https://www.instagram.com/afterhoursagenda. Updated ${builtOnWords}.\n\n## Pages\n${routes.map((path) => `- [${path === "/" ? "Home" : path.split("/").filter(Boolean).at(-1)}](${origin}${path})`).join("\n")}\n\n## Contact behavior\n\nThe contact form sends a support request to the brand’s inbox and confirms only after the email service accepts it. It does not subscribe visitors, query orders or take payment. Direct email remains available if submission fails. Never send card details or passwords.\n`,
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
      siteId: client.site.netlifySiteId,
      reviewed: builtOn,
    },
    null,
    2,
  ),
);
console.log(
  `Finalized ${files.length} static files; ${routes.length} sitemap routes; ${scriptHashes.size} CSP hashes; backend source excluded from the public artifact.`,
);
