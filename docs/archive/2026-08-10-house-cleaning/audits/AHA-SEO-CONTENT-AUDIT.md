# AHA SEO and Content Audit

Baseline: 2026-07-10.

## Findings

| Severity | Evidence | User/business impact | Location | Recommended action | Approval | Verification | Status |
|---|---|---|---|---|---|---|---|
| High | Domain configuration and docs mixed `www` and apex URLs | Canonical/structured-data/feed inconsistency could split signals | Runtime, metadata, sitemap, feed | Standardized local canonical output on verified apex host | No live mutation | Public redirect confirms www to apex; local canonical checks pass | Fixed locally, deploy pending |
| High | Bestseller route existed without sales-derived ranking | Unsupported popularity claims eroded trust | `app/best-sellers/page.tsx` | Reframed as Catalog Edit and changed nav label | No | Static copy review | Closed |
| High | No product feed implementation existed | Acquisition feeds could not consume the verified catalog | Repo inventory | Added review-free variant RSS/XML feed at `/product-feed.xml` | Account publishing gated | Local response contains 994 active variants | Implemented locally |
| Medium | No on-site review system is present, which matches v3 policy | Prevents policy drift and invalid rating markup | `ProductJsonLd.tsx` and feed tests | Explicitly test absence of Review/AggregateRating | No | `product-feed.test.ts` | Closed |
| Medium | Product/editorial copy quality and boilerplate uniqueness are not yet measured | Weak discoverability and product confidence | Product manifest/PDP/routes | Run duplicate/thin-content inventory | No | Content report | Open |

## Current positives

- Dynamic sitemap and robots implementations exist, including discovery routes and noindex commerce endpoints.
- Product JSON-LD component exists.
- Product metadata uses canonical product routes.
- `/product-feed.xml` uses the active profit-gated catalog and apex URLs.
- Clean product and collection routes exist.
- Build generates crawlable static pages for most policy/content routes.

## Next checks

- Submit `/product-feed.xml` only after Merchant/Meta/TikTok account approval and feed policy review.
- Crawl the deployed preview after release for titles, descriptions, canonicals, headings, status, links, and index directives.
- Inventory duplicate product descriptions and missing alt text.
- Define Merchant Center and paid-social feed contracts only after margin/product truth is complete.
