#!/usr/bin/env node
/**
 * Submit every sitemap URL to IndexNow (Bing, Yandex, Seznam, Naver share it).
 *
 *   node scripts/indexnow.mjs            # all sitemap URLs
 *   node scripts/indexnow.mjs /shop /product/black-sheep-tee
 *
 * The key file lives at public/<key>.txt (public by design — that is how the
 * protocol proves ownership). Run after a deploy that adds or renames pages;
 * Google does not use IndexNow — request indexing in Search Console instead.
 */
const HOST = "afterhoursagenda.com";
const KEY = "4e471ef1d880a090a6d260fe1449f40d";
const ORIGIN = `https://${HOST}`;

async function sitemapUrls() {
  const xml = await (await fetch(`${ORIGIN}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const args = process.argv.slice(2);
const urlList = args.length > 0 ? args.map((p) => (p.startsWith("http") ? p : `${ORIGIN}${p}`)) : await sitemapUrls();
const keyCheck = await fetch(`${ORIGIN}/${KEY}.txt`);
if (!keyCheck.ok || (await keyCheck.text()).trim() !== KEY) {
  console.error(`Key file not served at ${ORIGIN}/${KEY}.txt — deploy first.`);
  process.exit(1);
}
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} — ${urlList.length} URLs`);
if (!res.ok) { console.error(await res.text()); process.exit(1); }
