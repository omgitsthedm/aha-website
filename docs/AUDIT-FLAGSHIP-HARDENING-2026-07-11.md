# After Hours Agenda Flagship Audit and Hardening

Date: 2026-07-11  
Branch: `audit/flagship-hardening-20260711`  
Production baseline: `f57ce6b3c4e5700ea97d60ccfe57b15d6293f310`  
Scope: storefront UX, accessibility, SEO, structured data, performance, security headers, content, catalog discovery, and commerce guardrails.

## Executive result

The flagship design is visually coherent, responsive, and materially stronger than the production deployment. The primary defects were technical rather than stylistic: dynamic route metadata streamed into the document body, Product JSON-LD used an aggregate shape the audit tooling could not validate, the mobile navigation referenced an element absent while closed, collection filters exposed a label/content mismatch, default image fallbacks requested 3840px assets, and static metadata was too terse to describe important support and policy pages.

The fix pass preserves the newsstand/editorial visual system and purchase-flow boundaries. It does not alter prices, product mappings, payment behavior, fulfillment behavior, provider secrets, or live Square/Printful configuration.

## Verified environment

- Canonical Git root: `/Users/davidmarsh/Code/LiFi NYC/Clients/After Hours Agenda/Website/aha-website`
- Customer-facing path resolves through the LiFi workspace hierarchy.
- Netlify site: `afterhoursagenda` (`275b4115-16bf-42fb-9b36-6bce9bb93608`)
- Production URL: `https://afterhoursagenda.com`
- Git-backed production branch: `main`
- Netlify build: `npm run build`; publish directory: `.next`
- `verify:netlify-site`: passed before changes
- `verify:commerce-readiness:netlify`: passed before changes without printing secret values
- `verify:netlify-live`: passed against the public HTTPS site
- Local production build: passed before changes on Next.js 15.5.20

## Audit baseline

Approximate automated baseline from Squirrel surface crawls:

| Target | Pages | Score | Notable result |
| --- | ---: | ---: | --- |
| Production | 100 of 124 | 48/F | Deployed commit predates the flagship branch |
| Local flagship | 40 | 47/F | Local HTTP and production-domain sitemap create expected test-only penalties |
| Local hardened | 40 | 50/F | All remaining errors are local HTTP/sitemap artifacts; see category results below |

These scores are diagnostic, not launch grades. The local crawl loses security and crawlability points because it is served over HTTP at `127.0.0.1` while the sitemap correctly names the production HTTPS domain. Squirrel also treats Next.js responsive image fallback URLs and valid `fill` images as if they were the only browser resource and lacked dimensions. Browser QA and build output are the authority for those cases.

Post-fix category movement: Structured Data 34 → 100; Accessibility 51 → 81; Core SEO 59 → 91; Content 30 → 48; SEO errors 133 → 41. The remaining 40 security errors are the expected local-HTTP finding and the remaining crawlability error is the expected production-domain sitemap finding.

## Confirmed defects and resolutions

### P0 — Commerce and production safety

- No code-level commerce readiness failure was found.
- Exact Netlify target, live brand identity, and required environment-variable names passed their guards.
- No live checkout, payment, webhook, refund, fulfillment, or test order was submitted.
- The production Square webhook subscription and committed Netlify notification URL now use the same exact, non-redirecting endpoint. Signature delivery verification remains gated on the Git-backed production deploy.

### P1 — Search and structured data

- **Dynamic metadata after `<body>`:** confirmed in raw live and local responses. Configure Next.js to block metadata streaming for crawlers/link unfurlers so titles, descriptions, canonical links, Open Graph data, and Twitter data remain in `<head>`.
- **Product offers lacked directly validated prices:** replace one `AggregateOffer` with explicit per-variation `Offer` entries containing price, currency, availability, SKU, URL, and seller.
- **Generic duplicate product descriptions:** prefix the upstream catalog description with the unique product name and brand, then cap the result to a useful search-snippet length.
- **Product titles exceeded common snippet length:** emit a unique absolute title with a bounded product stem and the full brand name.
- **New Arrivals duplicate route metadata:** give the collection route a distinct title and canonicalize it to `/new-arrivals`.
- **Thin metadata on support/editorial pages:** expand titles and descriptions with specific, truthful page purpose. No keyword filler was added.

### P1 — Accessibility

- **Broken `aria-controls`:** keep the mobile navigation dialog in the DOM while closed via the native `hidden` attribute. Focus trapping and focus return remain active only while open.
- **Collection filter label mismatch:** mark the route-code badge decorative inside buttons so the visible collection name remains part of the accessible name.
- **Size tables lacked names/relationships:** add captions plus explicit column and row header scopes.

### P1 — Performance and delivery

- **3840px fallback image requests:** cap Next.js device sizes at 1920px while retaining responsive `srcset` behavior and the existing image `sizes` declarations.
- **Duplicate catalog work in one server render:** memoize Square product and collection loaders with React server-request caching. The existing five-minute upstream fetch cache remains intact.
- **Missing defense-in-depth headers:** add a restrictive Permissions Policy and one-year HSTS. A blocking CSP is deliberately deferred because Square Web Payments requires a tested policy and a careless CSP could break checkout.

## Visual and responsive review

Desktop and 390px mobile screenshots were inspected in a local production build. The newsstand grid, pink accent, mono typography, editorial mosaic, hierarchy, mobile CTAs, navigation, and product-discovery controls are coherent. The mobile hero is readable without horizontal overflow and the primary shopping action is visible before the first product image. No generic redesign or new animation dependency is justified.

## Tool findings classified as false positive or non-blocking

- **Potential DigitalOcean keys:** the matching `DO...` strings originate in `data/square-map.json`; they are Square catalog identifiers rendered into React data, not DigitalOcean credentials.
- **Missing image alt text/dimensions:** inspected examples are Next Image components with meaningful `alt`, `fill`, aspect-ratio containers, and responsive sizes. The crawler reports the optimized image endpoint rather than the source element context.
- **Local HTTPS and sitemap-domain errors:** expected when auditing `http://127.0.0.1:3010` against a production-domain sitemap.
- **CAPTCHA missing:** the newsletter already uses a Netlify honeypot. Adding Turnstile would require provider setup and adds friction; rate/abuse evidence should justify that change.
- **Thin policy/support pages:** word-count thresholds alone do not justify padding clear operational content to 300 words.
- **CSP:** the branch now enforces a Square-compatible policy with regression coverage. Final secure-card initialization remains an HTTPS production-domain check because Square rejects localhost as an application origin.
- **Product link orphan warnings:** the sitemap covers product routes; client-side catalog pagination means crawlers do not see all cards in the first shop response. Server-addressable pagination remains a future SEO enhancement.

## External remediation status

Authorized follow-up began 2026-07-11 at 20:11 MST.

- **Square webhook URL:** Square has one enabled production subscription at `https://afterhoursagenda.netlify.app/api/webhooks/square`. The committed production notification URL now matches it exactly. Production verification waits for the Git-backed deploy; no key value was printed.
- **Credential isolation:** the Square access token and application IDs were moved from all-context Netlify values to production-only values. The access token is now marked secret. Preview no longer inherits production access.
- **Sandbox preview:** a matching Sandbox app ID, access token, and location ID could not be obtained because both authenticated browser-control bridges were unavailable. Preview checkout therefore remains fail-closed instead of reusing production credentials. Explicitly flagged staging, deploy-preview, and branch-deploy contexts render the validated, versioned internal catalog for visual/content QA; production never enables that fallback. The non-secret flag is also scoped to Netlify preview/branch build, function, and runtime contexts because `netlify.toml` build context was not propagated to the Next server runtime.
- **CSP:** an enforced Square-compatible policy now covers production and Sandbox SDKs, PCI connections, wallet/SCA frames, image/font sources, framing denial, and object denial. Local header and regression checks pass; secure card initialization must be rechecked on the approved HTTPS production domain because Square rejects the localhost origin.
- **Catalog pagination:** `/shop?page=N` now renders 24 products per crawlable page with unique titles/canonicals and accessible page navigation.
- **Product storytelling:** customer-visible PDP copy and product schema now use unique product, garment, collection, fabric, policy, and shipping context rather than generic upstream Printful prose.
- **Netlify deploy protection:** `prevent_non_git_prod_deploys` is enabled and verified through the site API.
- **Published review:** draft PR #3 targets `main`; deploy preview `821966e` passed all eight desktop/mobile Playwright checks. GitHub did not start any Actions jobs because the account is locked for a billing issue, so required checks and the production merge remain blocked outside the repository.

## Validation checklist

- [x] Typecheck
- [x] Lint
- [x] Unit tests (26 passed)
- [x] Product, Square-map, Printful-map, and margin validation
- [x] Production build
- [x] Playwright desktop/mobile smoke tests (4 passed against the explicit local AHA URL)
- [x] Expanded Playwright pagination/CSP suite (8 passed against the explicit local AHA URL)
- [x] Product-copy and preview-catalog unit coverage (26 unit tests total)
- [x] Post-fix local crawl
- [x] Desktop and mobile browser QA, including mobile menu focus/open state
- [x] Git diff and secret-safe review
- [x] Agency status at closeout (AHA is the single expected dirty repo; one unrelated PHC repo is independently flagged `no-truth` and was left untouched)
