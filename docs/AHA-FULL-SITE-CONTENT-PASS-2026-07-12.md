# AHA Full-Site Content Pass — July 12, 2026

## Objective

Make the complete customer-facing site read like one established independent New York label: direct, specific, human, slightly irreverent, and precise whenever money, delivery, returns, privacy, or access are involved.

The governing concept remains **Black Sheep Newsstand**. Editorial pages can feel like a flyer archive or city bulletin; product, cart, checkout, order, and policy surfaces stay calm and literal.

## What changed

- Repositioned the homepage around the second shift, New York, the design index, and the left-facing black sheep.
- Expanded About into a real brand narrative covering the mark, design territory, made-to-order model, and audience.
- Reframed the Lookbook as `Outside Hours / Issue 001` rather than a generic image gallery.
- Rewrote live collection descriptions around specific AHA ideas instead of generic empowerment language.
- Added a canonical `/catalog-edit` route and converted `/best-sellers` into a permanent legacy redirect.
- Replaced shopper-facing Square/fallback terminology on Shop, New Arrivals, and Drops.
- Expanded FAQ, Shipping, Returns, Contact, Accessibility, Privacy, and Terms into usable customer information.
- Standardized public support contact on `info@afterhoursagenda.com`.
- Replaced provider boilerplate on PDPs with title-aware editorial context plus verified live garment facts.

## Product-content result

- Active products checked: **100**.
- Generated story bodies: **97 unique**.
- Unsupported scarcity, rating, or sales claims detected: **0**.
- The three repeated story bodies correspond to active duplicate product titles and remain a catalog/SEO decision, not a copy-generation failure:
  - `Be You` / `be-you-f27wez`
  - `Cities` / `cities-tizu5t`
  - `Retro Golf Rope Cap` / `retro-golf-rope-cap-df4ur3`

The content layer does not invent materials, collaborations, customers, press, reviews, stock counts, release dates, or design provenance. Fit, fabric, care, sizes, price, and availability continue to come from the existing commerce enrichment and live catalog.

## Voice rules now reflected in the site

- Brand surfaces: direct, witty when useful, New York-aware, and specific.
- Commerce surfaces: calm, literal, and recovery-oriented.
- No luxury clichés, generic hustle copy, fake rebellion, fake urgency, fake scarcity, or fabricated proof.
- “Design index,” “active archive,” “drop bulletin,” and “After Hours Dispatch” are the shared editorial vocabulary.
- “Bag,” “checkout,” “payment,” “production,” “shipping,” “return,” and “order status” remain the shared commerce vocabulary.

## Remaining content and asset gaps

These require real source material or a catalog decision and were intentionally not fabricated:

1. Resolve the three active duplicate-title product pairs and choose canonical product URLs.
2. Add real worn, rear, detail, and close-up images across priority PDPs where Square does not already provide them.
3. Add verified model height and size-worn notes to products after a real shoot.
4. Add customer/community photography only with permission.
5. Add press, collaborator, event, and retailer proof only when source links and usage rights are available.
6. Keep on-site reviews absent until a real review collection and moderation system exists.
7. Verify Instagram and TikTok account URLs before treating them as launch-critical acquisition links.

## Page-system completion

The second pass closed the required route gaps without inventing campaign history:

- `/drops/current` — current active release with live catalog data.
- `/drops/archive` — honest archive empty state until a real release can be documented.
- `/coming-soon` — launch-readiness explanation with no unverified date or countdown.
- `/lookbook/design-files` — the first individual design issue, built only from verified product assets.
- `/newsletter` — dedicated After Hours Dispatch landing page and consent explanation.
- `/restock` — separate product/variant availability request that does not silently subscribe someone to general marketing.

Navigation, footer, Drops, Lookbook, unavailable PDP states, sitemap, and Netlify form detection now connect those surfaces. Development CSP allows Next HMR evaluation only in development; production keeps the strict Square-compatible policy.

## Validation

- TypeScript: passed.
- ESLint: passed with zero warnings.
- Unit tests: 35 passed.
- Active product validation: 97 passed.
- Square mappings: passed.
- Printful mappings: passed.
- Margin floor: passed.
- Next production build: passed with 44 generated routes.
- Playwright: 12 passed across desktop and mobile; 2 expected provider-operation skips on mobile.
- Browser route checks: homepage, About, Catalog Edit, PDP, FAQ, Shipping, Returns, Contact, Privacy, Terms, Accessibility, Lookbook, and Drops rendered locally.
- Mobile visual checks: homepage, About, Catalog Edit, and `Be You` PDP.
- No live checkout, payment, order, fulfillment, email, provider, DNS, or production data mutation was performed.
