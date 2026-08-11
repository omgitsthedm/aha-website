# AHA Route Inventory

Baseline: 2026-07-10. Production build generated 28 routes.

## Customer routes

| Route | Implementation | Primary task | Current classification | Audit status |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Understand AHA and enter shopping | Current | Pending browser evidence |
| `/shop` | `app/shop/page.tsx` | Browse/filter products | Current | Pending deep audit |
| `/new-arrivals` | `app/new-arrivals/page.tsx` | Find recently added products | Current | Pending sales/data truth |
| `/best-sellers` | `app/best-sellers/page.tsx` | Find proven bestsellers | Current route; claim basis unverified | High-priority honesty audit |
| `/collections/[slug]` | `app/collections/[slug]/page.tsx` | Shop a collection | Current | Pending deep audit |
| `/product/[slug]` | `app/product/[slug]/page.tsx` | Evaluate and configure a product | Current | Highest-priority conversion audit |
| `/cart` | `app/cart/page.tsx` | Review/edit order | Current | High-priority audit |
| `/checkout` | `app/checkout/page.tsx` | Pay safely | Current | Critical total-honesty defect open |
| `/order-confirmed` | `app/order-confirmed/page.tsx` | Confirm purchase | Current | Post-purchase data audit pending |
| `/drops` | `app/drops/page.tsx` | Browse drop content | Current | Empty/content truth pending |
| `/lookbook` | `app/lookbook/page.tsx` | View editorial/product context | Current | Content proof pending |
| `/about` | `app/about/page.tsx` | Understand brand | Current | Design/content audit pending |
| `/size-guide` | `app/size-guide/page.tsx` | Reduce fit uncertainty | Current | Fit accuracy audit pending |
| `/shipping` | `app/shipping/page.tsx` | Understand delivery | Current | Policy truth pending |
| `/returns` | `app/returns/page.tsx` | Understand returns | Current | Policy/legal truth pending |
| `/care` | `app/care/page.tsx` | Care for products | Current | Content audit pending |
| `/faq` | `app/faq/page.tsx` | Resolve repeated questions | Current | Need/content audit pending |
| `/contact` | `app/contact/page.tsx` | Reach support | Current | Functional audit pending |
| `/privacy` | `app/privacy/page.tsx` | Understand data handling | Current | Legal approval required for changes |
| `/terms` | `app/terms/page.tsx` | Understand terms | Current | Legal approval required for changes |
| `/accessibility` | `app/accessibility/page.tsx` | Understand accessibility support | Current | Content audit pending |

## System routes and states

| Route/state | File | Risk/notes | Status |
|---|---|---|---|
| `/api/checkout` | `app/api/checkout/route.ts` | Legacy hosted-checkout path coexists with on-brand payment path | Audit pending |
| `/api/create-payment` | `app/api/create-payment/route.ts` | Money surface; critical total mismatch open | In audit |
| `/api/commerce/readiness` | `app/api/commerce/readiness/route.ts` | Protected readiness surface | Current |
| `/api/webhooks/square` | `app/api/webhooks/square/route.ts` | Signature URL mismatch | Critical open |
| `/api/webhooks/printful` | `app/api/webhooks/printful/route.ts` | Multi-store reconciliation audit pending | High priority |
| Loading | `app/loading.tsx` | Route-wide state | Pending visual/a11y audit |
| Error | `app/error.tsx` | Route-wide recovery | Pending functional audit |
| 404 | `app/not-found.tsx` | Recovery and navigation | Pending link audit |
| Sitemap/robots | `app/sitemap.ts`, `app/robots.ts` | Crawl/index control | Pending SEO validation |

## Confirmed gaps against the handoff

- No protected customer order-status route is present.
- No story-detail route or campaign landing template is present.
- Search route/overlay is not present in the route inventory.
- No lightweight commerce-health route exists.
- No account is required by current scope; guest checkout is correctly prioritized.
