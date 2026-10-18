# After Hours Agenda source of truth

## Verified current state — October 18, 2026

- Production is sourced from `omgitsthedm/aha-website` `main`. Read `/release.json` and the exact site's published deploy for its current commit and artifact digest rather than relying on a commit copied into a document.
- The exact production Netlify site is `275b4115-16bf-42fb-9b36-6bce9bb93608`, primary host `https://afterhoursagenda.com`. The active application is `site-preview/` (Astro); the root Next.js application is preserved historical source.
- Live publication is established only by the exact site’s published deploy, matching `https://afterhoursagenda.com/release.json`, and the corresponding GitHub source. Dated commits, PRs, branch names, build output, and this record are not live proof.
- The catalog has 15 sellable products and 102 variants. Two real customer orders were confirmed processed. This fact does not authorize paid test orders, samples, advertising spend, fulfillment changes, or customer messages.
- Google Merchant Center `5621180824` reports all 102 website-feed items approved. Meta catalog `4574410252846551` is active, Facebook/Instagram-visible, and has 102 taggable items.
- GA4 property `546226118` and Meta dataset `1815233516346046` have each observed two paid purchases. Events must continue to exclude direct customer data.
- The pre-release production database check confirmed `20261016140000_email_signups` and `20261018075000_fulfillment_monitor_repair` applied, with no missing-on-disk or out-of-order migrations. The additive `20261018120000_marketing_purchase_outbox` must be checked in the published release's database status. Migration status does not prove a live sign-up submission was tested.

## Operating facts

- After Hours Agenda is the sole customer-facing identity. Preserve its current visual system and warm, plain customer copy. Do not add TikTok or another business identity.
- `site-preview/` owns the active storefront, catalog, embedded Square checkout, scoped Netlify Functions, and current validation. Root Next.js commerce/provider code remains preserved and inactive.
- Catalog changes use the catalog engine and ledger. Preserve exact Square-to-Apliiq mappings, fulfillment allow lists, private label `SB-3-161622`, signed callbacks, durable checkout sessions, and the hold before paid orders route to Apliiq.
- Product images are garment-only; campaign images are separate. Campaign imagery remains torso-only, face-free, and subject to the brief’s text restrictions. Collection films retain their Pexels/AI disclosure and accessibility safeguards. The Fall 2026 advert is not publishable because its source footage/music are not cleared.
- Tracking is default-on for new visitors with footer opt-outs; Global Privacy Control disables Meta marketing. Never send names, email addresses, shipping addresses, payment details, or other direct customer data as tracking data.
- No paid test purchase, sample, ad spend, customer send, newsletter send, or new subscription is authorized unless a later user instruction explicitly scopes it. Handle secrets only in private approved settings; never commit or expose them.
- Changes remain preview-first. Node `24.21.0` checks, relevant tests, audit, build, and local visual review precede an authorized hosted preview or release.

## Marketing pipeline and remaining account steps

- The marketing pipeline adds channel attribution to the existing feeds, retains attribution through checkout, and prepares consent-aware Google/Meta purchase delivery using the same store IDs and Square order IDs as the browser. Missing credentials leave server delivery disabled; earlier purchases are not backfilled. Footer privacy choices narrow pending delivery, including retries and concurrent payment requests. An unavailable optional analytics write never blocks payment and suppresses after-payment tracking for that response.
- Production-mode validation passed 217 automated checks and 27 focused checkout/privacy browser checks; the full preview storefront suite passed 56 browser checks, and the production product-flow checks passed on desktop, mobile, and narrow layouts. Browser test requests are locally stubbed or blocked. Lighthouse blocks analytics collection while retaining the real SDK loading cost and performance budgets. These checks do not create real purchases, customer messages, or analytics visits.
- Server purchase delivery needs only `AHA_GA_MEASUREMENT_PROTOCOL_SECRET` and `AHA_META_CAPI_ACCESS_TOKEN` in private production function settings. Public measurement/dataset IDs come from `site-preview/client.config.json`. The browser setup is waiting for the owner to create the credentials; no secret values are in this repository.
- Historical campaign plans were retired during the owner-requested cleanup. They are not a fresh production checklist or evidence that additional imagery was completed. The next creative review is the original 2012 brand material with David, tracked in the pinned Current Work note.
- PR #131 is unrelated and must not be used as release, approval, or completion evidence.
- Google Ads account `9271187939` is cancelled and has no enabled or paused campaigns. Its reactivation control reached a reCAPTCHA frame that did not render; owner verification is pending. This does not block the approved free Shopping listings. The GA4-to-Ads link is prepared but still needs the required browser confirmation. No ads or spending were started.
