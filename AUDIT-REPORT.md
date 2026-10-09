# Latest addition — customer-service preview, October 9, 2026

Built the missing shopping and service foundations and researched the Ralph Lauren benchmark. **This new buildout is preview-only.** The already-published static website below remains live.

- [Open the current collection preview](https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app/shop/) · [Full buildout, research, evidence and remaining business gates](COMMERCE-BUILDOUT-2026-10-09.md).
- 24 preview pages; direct forms, protected order lookup, search/saved items/bag, guarded checkout, fit tools, unsubscribe and consent-controlled measurement. No unapproved product is opened for sale.
- 18 artifact/service tests in both modes; 806 preserved-backend tests; 19 local preview browser suites; 17 production-mode browser suites with two deliberate concept exclusions; 18 hosted suites with one local-only simulation excluded. Clean GitHub CI passes.
- Local mobile collection Lighthouse: Performance/Accessibility/Best Practices 100; LCP 0.9s, CLS 0.016, TBT 0ms. Preview SEO 69 reflects intentional noindex. No business or field-CWV result is claimed.
- Draft deploy `6ac8cf2d7bc79534fd2a0c3d`, runtime source `99d4a50ba481bec5b0b6439d7846d6687c037e8f`; 76 public files and all 24 routes verified. Production stays at `6ac8bf631f5bb00008938cac`.
- Physical product/specification/QC/policy approval, authenticated provider proof and a separate production service release remain open. The precise attempted remedies and release commands are in `NEEDS-APPROVAL.md` and the buildout report.

## Earlier completed static website release

# After Hours Agenda audit and modernization — final report

> **Production released October 9, 2026, 10:18:44 UTC:** [afterhoursagenda.com](https://afterhoursagenda.com) now serves the reviewed AHA rebuild. Published deploy `6ac8bf631f5bb00008938cac`, source `7a23f9846a337de2ac85bb34014d5b3f983ca71c`, artifact `f86427ebc511f08918e34c23c4feb936c65f86314bb5c4566acfc0b0ef5ae2ed`. PRs #93 and #98 are merged. All nine required GitHub checks, both build modes, 11 artifact tests per mode, 9 local browser suites and 9 live browser suites passed. All 60 public files match the local production artifact; all 16 routes, three search ownership files, headers, canonical URLs and noindex removal are verified. The earlier preview-only/review-required statements below are historical and superseded. Orders remain paused and contact prepares unsent email drafts as reviewed. No website-release approval remains pending.

The owner explicitly authorized production after reviewing the desktop mockups. The existing named-owner PR exception was used; protections were unchanged and no independent review was manufactured. The first Git build failed before publication because Netlify selected an obsolete nested preview-only config; the corrected config passed a full offline Netlify build before the successful Git release. Netlify reports no functions, scheduled functions or database migrations in the live artifact, plus its automatic on-publish database snapshot. Known deployment effect: one failed production build and one successful production deploy for this release; no extra review preview. Exact account billing delta was not measured. Final receipt and screenshots are in `/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/`.

## Historical audit and release preparation


> **Release follow-through, October 9:** The user approved moving the reviewed AHA candidate forward. The audit branch now contains the production configuration, mode-aware tests and preserved Google/Bing ownership files. GitHub requires one independent review plus its named checks; production remains unchanged until that gate clears. [Current release gate and exact commands](NEEDS-APPROVAL.md) supersede the historical approval queue below. The audit measurements and hosted preview receipt remain unchanged.

**October 9, 2026 · All five phases complete · Preview only**

Today was checked with `date`: `Fri Oct 9 00:26:43 MST 2026`.

## Delivered

- **[Open the After Hours Agenda preview](https://6ac8af91c681bfc763902db4--afterhoursagenda.netlify.app)**
- [GitHub audit branch](https://github.com/omgitsthedm/aha-website/tree/audit/2026-10-09) · [Compare with main](https://github.com/omgitsthedm/aha-website/compare/main...audit/2026-10-09)
- [Passing AHA CI](https://github.com/omgitsthedm/aha-website/actions/runs/37909429823)
- Local review and marketing package: `/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/OPEN REVIEW.html`.
- New source: `site-preview/` in the isolated audit worktree.

**After Hours Agenda keeps its own brand.** The user's correction supersedes the original LFNYC rebrand brief: custom-domain and future-client projects retain their own identity; only abstract projects use LFNYC branding. The active draft, current review package and marketing batch are all AHA. The earlier agency direction is superseded in Git and this task's evidence archive.

The original site was recently maintained. Production shipped October 8, Next.js was already 16.4.0, and its suite passed 805 tests. Confirmed defects included catalog-gated navigation, shopping claims after sales were paused, conflicting documentation, Node 20 and an unnecessarily broad runtime for the editorial review. The new preview fixes the public experience while preserving the original application and every live provider/data setting.

## Before / after scores

Editorial scores out of 10, assessed against the corrected AHA brief. These are not Lighthouse scores, certifications or sales results. The AHA brand was already established; changing it to another business was not an improvement. SEO/AEO scores describe readiness, because this preview deliberately carries noindex.

| Area | Before | After |
|---|---:|---:|
| Stack & dependencies | 5 | 9 |
| Architecture & quality | 6 | 9 |
| UI & accessibility | 6 | 9 |
| UX & support | 5 | 8 |
| Performance | 9 | 9 |
| SEO readiness | 6 | 9 |
| AEO / GEO readiness | 5 | 8 |
| Content & context | 5 | 9 |
| Security & operations | 6 | 9 |
| AHA brand fidelity | 9 | 10 |

Performance remains 9/10 because the original was already fast. The final numbers below replace every superseded LFNYC measurement. No lower before score or commercial improvement is manufactured.

## Changes across the ten audit areas

1. **Stack and dependencies.** Added a standalone static application on Node **24.21.0**, Astro **7.3.8** and supported TypeScript **6.0.3**. TypeScript 7 was checked and rejected because the current Astro checker supports 5/6. The complete new application dependency audit reports **0 advisories**. The preserved root has **9 development-chain advisory entries** (7 high, 2 moderate) and 18 direct packages with newer releases; its production-only graph had no reported advisories. The new artifact ships none of that commerce code. Root package/lock files and runtime remain unchanged in production. [Node lifecycle](https://nodejs.org/en/about/previous-releases), [Astro 7 migration](https://docs.astro.build/en/guides/upgrade-to/v7/).
2. **Architecture and quality.** Shared layouts, typed content, responsive-image manifests, simple native navigation and one local contact enhancement replace unnecessary runtime work in the preview. **16 public routes plus a 404**, **10 unit/artifact checks**, and **8 browser suites**. Root type checks exclude the separate package and still pass. No React runtime, API, account, payment, fulfillment, database query or cron function enters the artifact. Source: `site-preview/src`, `scripts`, `tests`.
3. **UI and accessibility.** Preserved AHA's paper `#FAFAFA`, ink `#1A1A1A`, coral fill `#FF6B6B`, accessible rose text `#CE3D56`, Poppins 400/700/900, JetBrains Mono and canonical black sheep. Source contracts resolve conflicting older design prose. Controls have visible focus and 44px minimum targets; content works without JavaScript. Tests cover 320px/640px reflow, desktop/mobile and axe A/AA checks with zero violations on tested pages. A mobile email-heading wrap found during visual review was fixed before deployment. Automated/keyboard checks are not full assistive-technology certification. [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
4. **UX and support.** Story, Lookbook, Answers and Contact remain available regardless of catalog state. The first screen states what AHA is and where to go. Closed Shop and Updates pages say new orders are paused. Existing-order support, shipping, returns, size and care paths remain visible. Contact validates fields, preserves values, prepares a draft, handles copy failure, supports editing and explicitly says nothing was sent. It goes only to **info@afterhoursagenda.com**. The preview does not automatically subscribe visitors or query customer orders; those production feature changes are explicitly gated below.
5. **Performance.** Static HTML, responsive WebP, local fonts, restrained JavaScript and cache headers reduce transfer. The homepage has **0 external script references**, versus **15** before, and **271 bytes of inline executable menu code**. Zero external files does not mean zero JavaScript. Matched hosted measurements are below; no blanket speed-improvement claim is made.
6. **SEO.** Unique titles and descriptions, one H1 per page, accurate draft canonicals, original AHA OG/icon assets, Organization/WebSite/WebPage/Breadcrumb JSON-LD, working internal links and a **16-route sitemap**. No made-up address, current product offer, review stars or availability data. Current entity/contact information agrees across pages, schema and crawler summary. HTTP and HTML carry noindex. The approved production variant was tested locally, then the preview artifact was restored; no production build was uploaded.
7. **AEO/GEO.** Direct answers cover current availability, AHA identity, imagery, support, returns and release updates. Visible captions distinguish AI campaign concepts, previous-run provider renders and actual brand archive. `llms.txt` is an optional maintained summary, not a ranking technique. Google states that it ignores llms.txt for ranking and requires no special AI markup. FAQ rich results were retired May 7, 2026; useful answers remain without chasing retired FAQ/HowTo features. [Google AI guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [Google updates](https://developers.google.com/search/updates).
8. **Content and context.** Kept the brand's original words, black-sheep identity and existing imagery provenance. Removed current-stock implications and agency-service copy from the active preview. Preserved prior purchase terms and made no release-date, price, sales or customer-review claims. `site-preview/claims.json` records sources. `README.md`, `AGENTS.md`, `CLAUDE.md` and `SOURCE_OF_TRUTH.md` now match the corrected brand, exact checkout, branch, host and static/legacy boundary.
9. **Security and operations.** Hash-based CSP without unsafe-inline/eval, same-origin-only connections, blocked embedded frames/objects and form submissions, appropriate referrer/permissions/content-type/transport headers, artifact hashing and production refusal by default. Known-credential-pattern checks found no matches in new source/artifact; this is a bounded scan, not a penetration test. Netlify reports no functions, schedules, plugins or database work on the draft. Original protected data, credentials and provider accounts remain unchanged; no private-database backup or transaction was attempted.
10. **Brand fidelity.** The website remains After Hours Agenda in the wordmark, sheep mark, palette, type, copy, support email, footer, metadata, icons, OG card, manifest and policies. No agency services, phone number, client portfolio or tugboat enters the active artifact. The complete marketing package was remade in AHA's identity. Regression checks reject the superseded business name/email and service slogans.

## Measured before / after

Lighthouse **13.5.0**, installed Google Chrome, **three mobile and three desktop runs for each version**, fresh browser profiles, matching configurations and tracker-blocking rules. Consent was not accepted. Values are medians. Tests ran against the original production and corrected hosted draft; the homepage composition changed. These are lab measurements, not a controlled conversion experiment.

| Measure | Before mobile | AHA preview mobile | Before desktop | AHA preview desktop |
|---|---:|---:|---:|---:|
| Lighthouse performance | 100 | 100 | 100 | 100 |
| Lighthouse accessibility | 100 | 100 | 100 | 100 |
| Lighthouse best practices | 100 | 100 | 100 | 100 |
| Lighthouse SEO | 100 | 69 | 100 | 69 |
| Largest contentful paint | 1.684 s | 1.429 s | 0.462 s | 0.534 s |
| Cumulative layout shift | 0.000115 | 0.002107 | 0.008085 | 0.002630 |
| Total blocking time | 27.5 ms | 0 ms | 0 ms | 0 ms |
| Transferred bytes | 457,080 | 296,371 | 503,515 | 296,377 |
| Requests counted by Lighthouse | 32 | 13 | 35 | 13 |

Mobile transfer fell **35.16%** and desktop transfer fell **41.14%**. Mobile LCP ranges were **1.399–2.443 s before / 1.391–1.732 s after**. Desktop ranges were **0.378–0.608 s before / 0.369–0.535 s after**. Desktop median LCP rose from 0.462 to 0.534 seconds; both remain well below 2.5 seconds and the sample ranges overlap. Mobile layout shift increased slightly and remains very small. The table retains those results rather than hiding them.

The preview's **69 SEO score is caused solely by intentional noindex**; every other scored SEO audit passes. Removing it to improve the score would violate preview-only scope.

Current good field CWV thresholds are LCP ≤2.5 seconds, INP ≤200 milliseconds and CLS ≤0.1 at the 75th percentile. These lab runs do not prove field CWV or INP; TBT is not INP. No sales, revenue, traffic, conversion, rankings or AI-citation increase is claimed. [Core Web Vitals](https://web.dev/articles/vitals).

## Search and AI access

- Google Search/AI Overviews: crawlable static HTML and normal entity/content signals; noindex excludes the review from intended indexing.
- Bing/Copilot: crawling remains allowed so noindex/noarchive can be read; no claim of inclusion or citation.
- OpenAI: search access is distinguished from training; GPTBot is denied. The preview remains noindex.
- Perplexity: search access is not confused with training. User-triggered fetch behavior may differ from a crawler's robots handling.
- Claude: search/user access is separate from ClaudeBot training, which is denied.
- Gemini: Google-Extended is denied on the preview. The prepared production variant allows it for Gemini grounding, which also permits the training use covered by that token. That tradeoff is in the approval queue.

Sources: [Bing](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a), [OpenAI](https://developers.openai.com/api/docs/bots), [Perplexity](https://docs.perplexity.ai/docs/resources/perplexity-crawlers), [Anthropic](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Google-Extended](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended).

The preview is public to anyone with its URL. Noindex is not authentication. Only public/cleared content is deployed.

## Verification and release receipt

- Original baseline: **582 tracked files** read/fingerprinted (486 text, 96 binary); opened source confirmed findings. Original lint, types, build and catalog validators passed; **805 tests passed, 3 skipped**. This is not a claim of manual line-by-line security certification.
- Brand/source review: the initially supplied 193-file LFNYC library was read for the original brief; the correction was implemented from actual AHA tokens, type, artwork, voice, current pages and image manifest. No LFNYC design authority remains in the active site.
- Corrected AHA app: lint **0 warnings**, types **0 errors**, **17 HTML pages built**, **10 tests passed**, full new-graph audit **0 advisories**.
- Browser: **8 suites passed locally, 8 on the host, and 8 in clean GitHub CI**. Coverage includes all 16 pages at desktop/mobile, 32 axe page scans, images, internal links, no errors, keyboard/menu Escape, form validation/draft/edit/copy failure, no writes, no-JS content, narrow reflow and actual API/missing-route 404s.
- **58 public files** match the built artifact byte for byte; the consumed `_headers` CSP matches the host; alias and immutable release markers agree. Public form/order/payment/provider requests were not sent.
- Exact site: **`275b4115-16bf-42fb-9b36-6bce9bb93608`**.
- Corrected draft: **`6ac8af91c681bfc763902db4`**, ready, **published_at = null**, branch-deploy context, plugin state none, functions/schedules empty and database activity absent.
- Source: **`f3f74ca1b4d950edcee8ecf7c94bccc27ab7a4d6`**. [Passing CI](https://github.com/omgitsthedm/aha-website/actions/runs/37909429823).
- Artifact digest: **`2f662f33802dd5d4aca79420b96836d3b90ea0e3d97e878f54e12b3f59a6f4a6`**. SHA-256 of sorted path/byte-count/per-file-hash entries for every artifact input except `release.json`; header configuration is included.
- Production remains **`6ac793e13b19850008db4a3a`** / main source **`c682761ef26bbedb4ea4f76fc869e7ded883a12d`**. Original checkout remains clean at `095d5884e720d66e659f3676187e028deecbb84e`.
- Two successful drafts across the session: the initial direction and the corrected AHA draft. The corrected deploy replaced the same active alias; no second active review alias was created. One initial CLI flag failure created no deploy. No merge or production promotion occurred.
- Draft/branch deploys use **0 deployment credits** under current Netlify pricing; bandwidth and request usage are separate and no account-level delta is claimed. [Netlify credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/).

The historical alias contains `lfnyc-audit` only because it was reused to supersede its earlier contents. Use the neutral immutable AHA link at the top for review and sharing. Later report-only commits do not change the deployed application or require another deploy.

Executed from the separate static staging folder:

```bash
netlify deploy --no-build --dir dist --functions functions-empty --alias lfnyc-audit-2026-10-09 --site 275b4115-16bf-42fb-9b36-6bce9bb93608 --message 'After Hours Agenda brand correction f3f74ca1b4d950edcee8ecf7c94bccc27ab7a4d6' --json
```

## Complete marketing package

At `/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/`:

- `OPEN REVIEW.html`: visual index, current AHA preview, report and package links.
- `screenshots/`: original and corrected hosted pages on desktop/mobile, menus, contact errors and draft states; `INDEX.md` maps them.
- `graphics/`: desktop/mobile comparisons, editorial scorecard and AHA brand poster, with reproducible HTML sources.
- `social/`: three matching 1080 × 1350 images, ready-to-post captions, alt text and the complete batch in one Markdown file.
- `case-study/AHA-MODERNIZATION.md`: problem, confirmed findings, changes and the actual AHA results.
- `links/LINKS.md`: preview, branch, compare, deployed source, passing CI and documents.
- `AUDIT-REPORT.md`, `DECISIONS.md`, `NEEDS-APPROVAL.md`: current copies.
- `evidence/`: raw measurements and verification. Superseded direction is explicitly archived separately.

Nothing was posted, emailed, scheduled or submitted to a search console.

## Remaining work

No tested preview defect remains open. Production migration is deliberately unexecuted. The concrete preparation includes a locally verified production mode, inactive static configuration, exact-site plugin step and merge sequence. The material business gate is acceptance of the static runtime's missing automatic signup/order lookup/provider endpoints, or approval to retain those behind a separately verified backend. All original implementations and live systems remain available. The full queue follows.

## Complete approval queue

# Approval queue — none of these actions executed

## 1. Production runtime migration, preserving the AHA brand

The current preview is After Hours Agenda. The original custom domain, business identity and production deployment remain unchanged. This draft does not authorize a production merge.

The prepared static migration changes the build base to `site-preview`, uses Node 24 and ships no functions. **It is a breaking runtime change:** automatic newsletter signup, automated order lookup, operational APIs and provider callbacks are not in the static application. The safe remedy for preview is complete: no customer queries or submissions, a working local email draft, clear collection status and support guidance. Before production, the owner must explicitly accept the reduced runtime or approve a separate backend-preservation implementation. Existing customer/order/provider data is not deleted or changed. Do not infer that closing new sales makes every historical endpoint safe to remove.

The exact proposed change is `cp site-preview/ops/production.netlify.toml netlify.toml`. The template changes the publish target to the static app, removes the root Next.js plugin declaration, sets Node 24, and enables the deliberate production build flag for `https://afterhoursagenda.com`. It keeps AHA branding and email. The tested production variant removes the review banner/noindex and uses the approved canonical origin. It allows Google-Extended for Gemini grounding, which also allows Google's covered training use; GPTBot and ClaudeBot remain denied.

Before any approved merge, on **site `275b4115-16bf-42fb-9b36-6bce9bb93608` only**, open Project configuration → Developer settings → Build plugins and disable `@netlify/plugin-nextjs` if still installed. Current read-only metadata reports that plugin. No other integration, data or secret setting is changed.

Only after explicit production approval covering the runtime changes above and that plugin step:

```bash
(
set -e
cd '/Users/davidmarsh/Desktop/Project Upgrades/afterhoursagenda/worktree'
git switch audit/2026-10-09
git fetch origin main
test "$(git rev-parse origin/main)" = c682761ef26bbedb4ea4f76fc869e7ded883a12d
cp site-preview/ops/production.netlify.toml netlify.toml
git add netlify.toml
git commit -m 'build: prepare approved AHA production migration [skip netlify]'
git push origin audit/2026-10-09
gh pr create --repo omgitsthedm/aha-website --base main --head audit/2026-10-09 --title 'Launch approved After Hours Agenda modernization' --body-file site-preview/ops/promotion-pr.md
gh pr checks audit/2026-10-09 --repo omgitsthedm/aha-website --watch
AHA_APPROVED_HEAD="$(git rev-parse HEAD)"
gh pr merge audit/2026-10-09 --repo omgitsthedm/aha-website --squash --match-head-commit "$AHA_APPROVED_HEAD" --subject 'feat: launch approved After Hours Agenda website'
)
```

The subshell stops on failure. The `test` stops if main has changed; reconcile and revalidate before continuing. Required PR checks and repository approval rules must pass. A main merge triggers the Git-connected production build. Never manually promote the noindex draft unchanged. No DNS or domain change is needed or authorized.

After the approved build, verify the public `release.json` source/site/mode, exact Netlify published deploy, Git main, every route and header, sitemap origin, noindex removal, and the accepted backend/support behavior. If verification fails, restore published deploy `6ac793e13b19850008db4a3a` through this exact site's Deploys interface under the release/rollback authorization. Do not alter provider data.

## 2. Restore automatic acquisition and order lookup, if required for production

The original implementations remain in the preserved root application. No existing integration is disconnected. A future scoped implementation must retain AHA-owned recipients/accounts, server-side validation, abuse controls, appropriate consent and truthful success/error states. Newsletter tests must not actually subscribe anyone; order tests must use an approved non-production fixture. No LFNYC or future-client destination belongs in this project's flows.

## 3. Live commerce and provider retirement

Do not reopen checkout, publish products, change inventory, prices or mappings, create transactions, modify callbacks, retire providers or delete records. Those actions require separately named resources, verified readiness and explicit scope. No blanket deletion or provider-mutation command is prepared because no such change is part of this release.

## 4. External publication and account changes

The complete AHA marketing batch is local and unpublished. No post, email, campaign or search-console submission was sent. Posting and submission of a future live sitemap remain separate external actions. No spend, billing, account creation, DNS or hosting change is required.
