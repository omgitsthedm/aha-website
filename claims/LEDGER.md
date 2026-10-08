# Claim ledger — After Hours Agenda SEO (2026-10-08)

Evidence packet: `SOURCE_OF_TRUTH.md` + live-site strings in this repo. Labels: approved fact / supportable interpretation / owner decision.

## New / changed claims

| # | Claim (where) | Evidence source | Label |
|---|---|---|---|
| 1 | llms.txt: shop/product/bag/checkout CLOSED, contact-first release | `SOURCE_OF_TRUTH.md` "Live storefront contract" + `lib/commerce/catalog-policy.ts` (`publicCatalogEnabled:false`, `checkoutEnabled:false`, read 2026-10-08) | approved fact |
| 2 | llms.txt: available pages = home, lookbook, about, contact, newsletter (+ info pages) | Same sources; info pages (faq/shipping/returns) verified present in `app/` | approved fact |
| 3 | llms.txt: support `info@afterhoursagenda.com`, socials @afterhoursagenda | `components/ui/SiteFooter.tsx:50-63` + `StorefrontJsonLd.tsx` email/sameAs | approved fact |
| 4 | llms.txt drops "sells an active capsule / checkout handled by Square" | Those lines contradicted the closed-commerce code state; removed as false | approved fact |
| 5 | FAQ `speakable` → `#faq-list` (`app/faq/page.tsx`) | Selector matches `id` on the rendered FAQ list (prior-run edit, verified by read) | supportable interpretation |
| 6 | robots.ts keeps DENYING GPTBot/ClaudeBot/Google-Extended (+ bulk crawlers) | Pre-existing property opt-out; task directive says allow *unless property opts out* — honored, unchanged | owner decision |

## Verified pre-existing (kept, not changed)

- `buildMetadata` canonical + OG + Twitter on every content route (24 files); Organization + WebSite JSON-LD; FAQ JSON-LD generated from the rendered `faqs` array (cannot drift); sitemap gates catalog paths on `isStorefrontPublic()`; Google/Bing verification intact.

## Out of scope / unknowns (owner questions)

- NAP + GBP: no physical address is published (online-only brand; email + socials are the consistent contact surface). IF the owner wants local discovery, they must supply a real address/hours first — nothing invented.
- Prices, availability, restock dates: stay out of all SEO copy until a separately authorized commerce reopening.
- No reviews, ratings, testimonials, awards, or outcome promises were added.
