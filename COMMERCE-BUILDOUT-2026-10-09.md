# After Hours Agenda — storefront and service buildout

Started October 9, 2026. Scope: build the missing features and research the Ralph Lauren standard. This is a new preview candidate; the published October 9 website remains unchanged.

## Completion

Build and verify direct support and newsletter capture, order lookup, catalog/product/search/saved-item/bag interfaces, checkout integration, fit/care and returns flows, consent-controlled measurement, accurate production copy, and a deployable preview. Verify desktop/mobile, keyboard, failure states, no-JavaScript fallbacks, server validation and preview isolation. Do not fabricate stock, product approvals, reviews, service promises, sales, or field performance. Record external launch inputs precisely.

## Findings and execution order

1. Fix release-mode wording throughout content and metadata; regression-test every production HTML page.
2. Replace the local-only contact draft with Netlify Forms support intake; add explicit-consent email capture and returns intake, with honest success/failure and preview behavior. Retain direct email fallback.
3. Add a rate-limited order lookup using the existing order database, with order number/email/postal-code verification and minimal results. Preview never reads customer records.
4. Add collection browsing, search/filtering, product detail, saved items and a bag. Current Yikes and Insomniac records may appear only as labeled preview development studies. No August catalog is reopened. Product data needs a reviewed launch manifest before sale.
5. Reuse the existing Square payment, tax, idempotency, durable-order and Apliiq fulfillment implementation through a guarded server adapter; never restore the retired payment-link shortcut. Keep payment and fulfillment disabled in preview. Test the integration without a live transaction.
6. Add first-party, consent-controlled measurement with no customer data in event payloads, Core Web Vitals collection, and an owner report. Preserve Global Privacy Control and disabled-storage fallbacks.
7. Add useful fit, garment-care, customer-service and return-request flows. Preserve prior purchase terms. No invented free returns, delivery date, phone number, hours, reviews or sustainability claim.
8. Finish build/lint/type/unit/browser/security checks locally, make atomic commits, push the audit branch, and replace its single draft preview. Record exact source and host evidence here and in the existing links/report files.

## Current research — October 9, 2026

- Ralph Lauren provides direct contact intake, guest order tracking, returns/exchanges and gift returns; borrow the complete service paths, not its staffing claims. Sources: https://www.ralphlauren.com/contactus ; https://www.ralphlauren.com/returns ; https://www.ralphlauren.com/support?a=Order-Status-and-Package-Tracking---id--S38uV7sGR1uaoftrxEPMZQ . Search indexed US support content; one direct contact fetch redirected geographically to Denmark, so US policies are not assumed universal.
- Product confidence needs accurate material, construction, fit, size and care detail, clear variants, useful images and availability. Sources: https://www.ralphlauren.com/men/men%E2%80%99s-cotton-mesh-polo-shirt/398630.html?cgid=men ; https://www.ralphlauren.com/size-guide/size-guide.html . Never copy its measurements onto AHA garments.
- Saved items, gift services and styling assistance help shopping. RL also offers gift packaging, personalized items and appointments: these depend on real operations and are not promises AHA can make today. https://www.ralphlauren.com/gift-services . Native apps, physical store locators and international markets are later-stage business capabilities, not required website decorations.
- Google ProductGroup/hasVariant markup must match real products and offers. No Product/Offer markup for unapproved concept garments. https://developers.google.com/search/docs/appearance/structured-data/product-variants . Merchant feeds require approved catalog/policy data, not an empty or fabricated feed.
- Good Core Web Vitals targets at the 75th percentile: LCP <=2.5s, INP <=200ms, CLS <=0.1. Lab checks are not field results. https://web.dev/articles/vitals .
- Netlify Forms detects built HTML; post URL-encoded fields, check errors and provide spam protection. https://docs.netlify.com/manage/forms/setup/ . Functions use explicit routing, response headers and per-IP rate limits. https://docs.netlify.com/build/functions/api/ .

## Business work beyond code

Physical sample/fit/wash QC; current approved garment/color/size range; verified Apliiq decoration and labels; real finished-product photography; cost/margin and shipping/tax decisions; return/exchange rules for the new range; packaging and packing inserts; a staffed support inbox and fulfillment exception process. These require evidence, supplier work or owner decisions. Current collection files explicitly say review candidate, not production-approved. Website code cannot supply these facts.

## Source corrections and decisions

- Canonical website maps to the Desktop client Website directory; new work stays in the existing isolated output worktree on audit/2026-10-09.
- The asset paths remembered under the client folder no longer exist. Current guide and kit were found and read at /Users/davidmarsh/Desktop/After Hours Agenda/; they are read-only inputs.
- Brand remains After Hours Agenda: Poppins, JetBrains Mono, paper/ink/rose, original assets. Existing public identity remains; no new uncleared logo variant is introduced.
- Netlify masks production Square and Resend credentials on retrieval. Presence is confirmed; provider health is not proven. No secret values were written or printed.
- Existing policy closes both legacy Printful and Apliiq catalog/checkout. Historical maps and August approvals are not approval for the current collection.

## Verification and remaining launch gates

Implementation, local checks, clean GitHub CI and hosted preview verification are complete. This is a review candidate, not a live commerce launch.

| Area | Published site before this buildout | New review candidate |
| --- | --- | --- |
| Browsing | Archive and closed-shop notice | Filtered collection, detail pages, search and local saved list |
| Customer service | Unsent email draft | Support and returns intake with validation, consent, failure recovery and email fallback |
| Release list | Instagram link only | Separate-consent newsletter capture plus unsubscribe protection |
| Existing orders | Email instructions | Three-detail order lookup, minimal results, filtered carrier links and a fictional preview fixture |
| Buying | No active purchase path | Bag and Square quote/payment adapter, held closed until approval and provider proof |
| Fit | General copy | Measuring diagram, unit converter and validated per-product measurement structure |
| Measurement | None | Opt-in first-party counters and CWV histograms; GPC/DNT respected |
| Payment integrity | Preserved backend treated authorization as payment | APPROVED waits; only COMPLETED starts fulfillment |

Local checks: new application lint, typecheck, build and 18 artifact/service tests pass in preview and production modes. Full preserved backend: 806 tests pass; three existing tests remain skipped. All 19 preview browser suites pass in installed Chrome. Production mode: 17 pass; two concept-product tests intentionally skip because those products do not exist in production. Coverage includes every page at desktop/mobile, WCAG A/AA automated checks, 320px reflow, keyboard menu, no-JavaScript fallback, forms, consent, search, saved-list persistence, blocked storage, guarded checkout and a completely mocked quote/payment flow.

All 14 historical migrations plus the new additive migration ran against disposable local Postgres and replayed without reapplying. SQL injection/mismatched lookup details, partial refunds, unsafe carrier URLs, consent replay after unsubscribe and concurrent metric increments are covered. No production records were queried or changed.

The new website dependency audit reports zero vulnerabilities. Eight function archives build for Node 24. The separately installed current Netlify CLI brought vulnerable development-only transitive dependencies; a compatible npm audit fix did not resolve them. It is temporary isolated tooling, never a website/runtime dependency, and was removed after the draft was verified. No global tooling/configuration was changed.

Mobile Lighthouse on the local collection page: Performance 100, Accessibility 100, Best Practices 100; lab LCP 0.9s, CLS 0.016, TBT 0ms, transfer 264 KiB. SEO is 69 because the preview deliberately blocks indexing. These are lab results from one run, not field Core Web Vitals, unique visitors, sales or conversion improvements. Production indexing is checked separately in HTML/artifact tests.

Screenshots: `screenshots/customer-buildout/` in the Desktop output folder contains 20 captures: 16 current before/local-after screens and four hosted-preview screens across desktop and mobile; the two capture indexes identify each URL and viewport. Local visual inspection confirmed the collection and mobile product layout. Evidence logs and Lighthouse JSON are in `evidence/customer-*`.

## What the Ralph Lauren standard adds beyond this release

**Before accepting money:** a tightly edited launch range with a repeatable fit block; final samples and wash/wear/print checks; real front/back/detail/on-body photos; material composition and origin; garment labeling and care evidence; landed cost, return allowance and contribution margin; available sizes tied to the approved provider; realistic dispatch windows; clear new-order return/exchange rules; staffed support, delivery exceptions and reconciliation. The current kit and provider mapping policies were inspected; those physical and commercial approvals are not established for the new range. The new manifest validator and readiness command enforce the website side instead of inventing the missing facts.

US textile guidance covers fiber content, origin and responsible-business identity. Care instructions need a reliable basis, and applicable clothing flammability requirements need supplier/testing evidence. The requirements depend on the actual product; a website checkbox does not establish compliance. Sources: [FTC textile labels](https://www.ftc.gov/business-guidance/resources/threading-your-way-through-labeling-requirements-under-textile-wool-acts), [FTC care labeling](https://www.ftc.gov/legal-library/browse/rules/care-labeling-textile-wearing-apparel-certain-piece-goods-text), [CPSC clothing textiles](https://www.cpsc.gov/s3fs-public/1610-Fact-Sheet-Clothing-Textiles-English.pdf). If delivery cannot meet the promised timing, the customer needs the appropriate delay/cancellation/refund path. [FTC order-shipping rule](https://www.ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule).

**Next commercial layer:** real product reviews with purchase verification and moderation; delivery-date messaging tied to provider capacity; a proper return/exchange authorization workflow; Apple Pay/Google Pay after merchant/domain readiness; approved product feeds and Merchant Center; lifecycle email with verified sender identity, consent/suppression and monitored delivery; product-specific restock interest; gift packaging/messages after the supplier can fulfill them. The preserved backend contains review and lifecycle components, but this candidate does not pretend those inactive systems are a finished customer service. Existing legacy components remain protected for the next validated release.

**Later, when operations justify it:** signed-in cross-device wishlists, personal styling appointments, loyalty benefits with real economics, gift-card liability/balance/refund handling, wholesale accounts, international duties/currency/local returns, repair/tailoring, physical-store pickup and a store locator. Ralph Lauren offers gift and in-store services; AHA has no verified store network or staffing for those promises. [Ralph Lauren gift services](https://www.ralphlauren.com/gift-services), [online gifting](https://www.ralphlauren.com/gift-services-%7C-online/cs-gift-services-online-only.html), [returns/exchanges](https://www.ralphlauren.com/returns?LoginLocation=header).

**Brand standard:** consistent fit and construction, a recognizable assortment, real product photography, packaging, dependable customer care and a coherent editorial calendar. That is the remaining gap to a mature clothing business. Copying navigation, publishing an app, displaying fake reviews or adding a loyalty badge will not supply it. This is an assessment of the AHA evidence, not a claim about Ralph Lauren's private operations.

Google supports variant relationships for actual products; the new product template emits offers only for an approved release. [Product variant guidance](https://developers.google.com/search/docs/appearance/structured-data/product-variants). Google says its AI search features use the same foundational SEO practices; no special AI schema or machine-readable file is required. The existing llms.txt is an explanatory summary, not a ranking promise. [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features).

## Exact remaining gates and attempted remedies

- Product approval: read the current kit, collection and two design studies; built a schema and source validator. Result: zero approved saleable products. The owner/supplier must provide current physical sample, specification, pricing, labels/QC and policy evidence before activation.
- Provider proof: inspected actual backend, mappings and Netlify credential names; attempted read-only credential retrieval and checked both exact project roots for private environment files (only examples exist). Result: values are masked, so current Square/Apliiq/Resend health is unproven. Authenticated provider verification and a real sandbox receipt remain required; no live transaction was used as a test.
- Production service delivery: built real Forms/function adapters and tested their success/failure paths with local mocks and local Postgres. Preview deliberately does not create a submission or touch customer data. Actual production inbox delivery, sender health and migrations must be verified as part of an authorized service release.
- Publication: all code stays on `audit/2026-10-09`; the draft is for review. The previous production approval covered the already-published static release. Exact future release commands and commercial gates are in `NEEDS-APPROVAL.md`.


## Hosted review receipt

- Preview: https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app/shop/
- Immutable deploy: https://6ac8cf2d7bc79534fd2a0c3d--afterhoursagenda.netlify.app
- Exact Netlify site: `275b4115-16bf-42fb-9b36-6bce9bb93608`; deploy `6ac8cf2d7bc79534fd2a0c3d`; branch-deploy context, published_at null.
- Runtime source: `99d4a50ba481bec5b0b6439d7846d6687c037e8f`. Static artifact digest: `7054bf46a30f27508947cf28b4fc2038ee54b311203a101909dc2db7c2099ffa`. Preserved service-bundle digest: `5dccdec579c4b0db960ddde2bcc3a9f84480c5d5a939f94bf9b7c665553d9c15`. Function archive hashes are separately scoped in `evidence/customer-function-archives.json`.
- Netlify confirms all eight hosted functions use Node 24; their exact host digests and schedules are recorded in `evidence/customer-hosted-functions.json`.
- All 76 retrievable public files match their local SHA-256 hashes. All 24 HTML routes carry noindex. Hosted order fixture/unsubscribe/measurement confirm preview behavior; forged checkout returns 409 and provider webhook returns 503 before any provider work.
- Hosted installed-Chrome verification: 18 browser suites pass, one local-only payment simulation intentionally skipped. The separate local payment simulation passes.
- Clean GitHub CI passes at `e965cea0711a41e100dfdb5905fe5f02ade252cd`: https://github.com/omgitsthedm/aha-website/actions/runs/37923825500 . That follow-up fixes clean-checkout generation order and verification scripts only; deployed UI, services and data are unchanged from 99d4a50. Later documentation commits do not republish the same artifact.
- One successful review deploy replaced the existing alias. An earlier CLI command rejected an incompatible flag before creating a deploy. No production deployment, merge, message, payment, supplier order or manually applied hosted migration. Draft bandwidth/function request usage occurred; account billing delta was not measured.
- Production rechecked unchanged: deploy `6ac8bf631f5bb00008938cac`, source `7a23f9846a337de2ac85bb34014d5b3f983ca71c`.
