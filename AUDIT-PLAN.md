# LFNYC rebuild plan — 2026-10-09

Written before implementation. Date verified with `date`: Fri Oct 9 00:26:43 MST 2026.

## Verdict

This is a recently maintained commerce application carrying a closed shop, not year-old abandoned code. The current production release is October 8, 2026, commit `c682761ef26bbedb4ea4f76fc869e7ded883a12d`, Netlify deploy `6ac793e13b19850008db4a3a`. Next.js is already 16.4.0. Its architecture, brand, offers, and customer paths are wrong for an LFNYC service business. Repainting it would leave payment, catalog, account, email, database, and fulfillment machinery attached to a brochure site. Build a separate static LFNYC application and deploy only its explicit artifact to a draft on the exact existing site.

The inherited test suite is substantial: 805 passing tests, 3 explicitly skipped, lint/build/typecheck/catalog validation passing. Do not claim that tests are missing. The runtime and documentation do lag: production functions use Node 20, while Node 24 is current LTS; README says Next 15; SOURCE_OF_TRUTH names an older release and obsolete local path. Full npm audit reports 9 dependency findings (7 high, 2 moderate), all in the development chain; 18 direct dependencies have newer releases. These are dependency findings, not 9 proven exploitable website vulnerabilities.

Scores measure fitness for this LFNYC brief, not the quality of the original clothing brand. They are editorial audit judgments, not Lighthouse scores.

| Area | Before /10 | Basis |
|---|---:|---|
| Stack and dependencies | 5 | Current Next, EOL production Node 20, 9 dev-chain advisory entries |
| Architecture and quality | 6 | Strong commerce tests; excessive machinery for the requested service site |
| UI and accessibility | 3 | Coherent AHA styling; wrong identity, small labels, no LFNYC hierarchy |
| UX and conversion | 3 | Main navigation gates About/Lookbook with closed catalog; weak route to help |
| Performance | 6 | Optimized images; homepage still loads 15 external scripts and about 174 KB encoded JS in observed browser run |
| SEO | 6 | Metadata, sitemap, canonical handling exist; they describe the wrong business |
| AEO/GEO | 5 | Existing llms.txt and entity data; wrong entity/offers for this mission |
| Content and context | 3 | About advertises current shopping while commerce is closed; docs contradict release |
| Security and operations | 6 | Guarded payments, consent, headers and tests; EOL runtime and unnecessary service attack surface |
| LFNYC brand | 1 | AHA names, sheep, rose, Poppins, email, metadata and legal copy throughout |

## Evidence and coverage

- Exact checkout resolved through `ai-system where` and fleet `project-context`; site ID verified in the opened fleet entry and live Netlify metadata: `275b4115-16bf-42fb-9b36-6bce9bb93608`.
- All 582 tracked files read and fingerprinted (486 text, 96 binary; 21,497,921 bytes) in `../evidence/source-inventory.json`. Whole-project ESLint, TypeScript, tests, and build supply executable checks. Source review confirms each finding in the actual file. Provider datasets and migration snapshots were read as data; protected live customer data was not queried. This is not a claim of manual line-by-line security certification.
- Full brand content, assets, fonts, color tokens, usage rules, linked DESIGN.md and canonical tokens inspected; 193 unique brand-library files read and fingerprinted. Palette, mark, voice and type are explicit, not inferred from production styling.
- Old home, About, Contact, Lookbook and closed Shop captured at desktop 1440×1000 and mobile 390×844 in installed Google Chrome. All returned 200 without JS exceptions. No live forms, orders or emails submitted.
- Baseline Lighthouse collection runs separately with three mobile and three desktop samples. The final report will distinguish lab results from field CWV and commercial outcomes.

## Ranked findings and exact fixes

| Impact | Confirmed finding | Why it matters | Exact fix | Effort |
|---|---|---|---|---|
| P0 | `netlify.toml`, deployed functions: Node 20.20.2 / nodejs20.x | Unsupported runtime; unsuitable new baseline | Use project-local Node 24.21.0 and current Astro 7.3.8 static generation; ship no functions | M |
| P0 | `app/layout.tsx`, `lib/content/brand-copy.ts`, public branding are AHA | Visitors cannot identify the requested business | New LFNYC layout, tugboat, Oswald/Barlow/Mono, midnight/orange tokens, service copy, icons and OG art | L |
| P0 | Root contains commerce, provider, auth, database and email infrastructure | Rebranding must not route LFNYC leads into AHA providers | Separate `lfnyc/` package and explicit static-only deploy configuration; no inherited functions or migrations | M |
| P1 | `components/ui/SiteNav.tsx` hides editorial links with catalog gate | Closed shopping also breaks basic navigation | Unconditional semantic nav, compact mobile menu, visible contact path, keyboard/Escape behavior | S |
| P1 | `app/about/page.tsx` still says current eight are in the shop and links products | Public copy contradicts actual availability | Replace active preview with truthful LFNYC services and published-work proof; preserve AHA source for recovery | M |
| P1 | Global cart/platform/feedback/consent clients mount across pages | Unneeded JS and tracking complexity | Static HTML with only small menu and contact-brief enhancements; no trackers, no cookies, no third-party requests | M |
| P1 | Full audit contains 9 dev dependency entries; Next ESLint version trails Next | Old graph stays expensive and fragile | New pinned minimal app graph; audit all dependencies, fix compatible advisories; separately report retained legacy graph | M |
| P1 | Metadata/schema/llms/manifest describe apparel | Machines and visitors receive the wrong entity | Shared route metadata, Organization/WebSite/Service/Breadcrumb JSON-LD, generated sitemap, accurate llms.txt | M |
| P1 | Preview is not a production site and is public to link holders | Accidental indexing or lead capture would misrepresent status | Enforce noindex in HTML and HTTP, explicit preview banner, no form backend, no analytics; do not claim privacy | S |
| P1 | README, AGENTS and SOURCE_OF_TRUTH contain obsolete paths/release facts | Another agent can target the wrong checkout or deploy | Rewrite branch contract to distinguish legacy production from new preview and document exact commands | S |
| P2 | Labels use 10–14 px; brand requires 16 px floor | Readability fails the supplied identity/access standard | 16 px floor, 18–20 px body, 44 px targets, visible focus, 200% reflow, reduced motion, no-JS content | M |
| P2 | `lib/security/rate-limit.ts` is process-local; manual cron guard trusts a scheduler-shaped body when automations are enabled | Legacy services require careful operational ownership | Exclude every legacy API/function from LFNYC artifact; queue any production retirement separately | S |
| P2 | `.lighthouserc.mobile.json` allows 2750 ms LCP | Budget exceeds Google's good LCP threshold | New artifact budgets ≤2500 ms lab LCP, ≤0.1 CLS and ≤200 ms TBT; report field INP unavailable | S |
| P2 | Domain remains afterhoursagenda.com, distinct from existing LFNYC site | A merge cannot silently decide a business/domain migration | Keep draft alias; prepare gated promotion instructions and preserve all live domain settings | S |

## Rebuild, in order

1. Keep the original application and production configuration intact. Work from current `origin/main` in the isolated `audit/2026-10-09` worktree. Preserve the original checkout and unrelated branch commits.
2. Create `lfnyc/` with current stable Astro, strict types, a small dependency graph, a local runtime, deterministic static build, and explicit draft deployment. Native CSS consumes the Brand Kit tokens; no UI framework or client React runtime.
3. Build the real site: Home, three service routes, Work, About, Contact, Answers, Privacy, Terms, Accessibility, and 404. Websites lead; urgent help remains direct; owned software is the premium path. Use only verified published-work examples and supplied brand photography.
4. Create an accessible contact brief that prepares an editable email and clearly says nothing has been sent. Keep visible phone/email fallbacks without JavaScript. Do not collect or submit data to AHA's Netlify forms or email services.
5. Add shared SEO/entity data, accurate answer content, crawl policy, sitemap, llms.txt, branded social preview and icons. Preview remains noindex. No ranking, AI citation, revenue, or invented project-result promises.
6. Harden the static artifact: strict CSP with script hashes, headers, cache rules, artifact allowlist, no functions, no secrets, and a production-context guard. Add build/type/lint and meaningful route, keyboard, form, metadata, security and accessibility checks.
7. Complete local checks, manually inspect desktop/mobile, record after metrics, fix failures. Commit in small units. Push only the audit branch with Netlify skip markers; make one manual draft deploy after the candidate passes.
8. Verify the exact hosted artifact, headers, all routes, mobile navigation, contact states, no-JS content, 404 and no legacy API. Capture hosted after screenshots and repeat Lighthouse with matching settings.
9. Produce one complete unpublished batch: comparison graphics, score cards, matching social images/copy, an evidence-based case study, links, decisions and final report. Print the final report and the approval queue.

## Quick wins under one hour each

- Restore unconditional navigation in the replacement shell.
- Replace all active brand/contact/metadata identity in one shared content module.
- Use the supplied self-hosted fonts and tugboat files.
- Remove tracking, purchase prompts and cookie UI from the static preview.
- Add noindex, secure headers, useful 404, static sitemap and explicit contact fallback.
- Correct branch documentation and exact-site deploy commands.

## Approval queue

Do not execute: merge to main, promote production, replace the AHA live storefront, change DNS/domain ownership, retire commerce/provider data or services, enable production lead storage/email, spend on services, or submit to search consoles. Exact prepared steps will go in NEEDS-APPROVAL.md. Missing approvals do not block the preview, source, tests or marketing package.

## Current standards verified October 9

- Node 24 LTS and Node 20 EOL: https://nodejs.org/en/about/previous-releases and https://nodejs.org/en/about/eol
- Registry queries: Astro 7.3.8, Next 16.4.0, TypeScript 7.0.2, Playwright 1.64.0; compatible versions will be pinned and tested, not installed blindly.
- Astro 7 / Vite 8 migration: https://docs.astro.build/en/guides/upgrade-to/v7/
- CWV: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at the 75th percentile: https://web.dev/articles/vitals
- Google AI guidance: HTML, useful original content and normal SEO matter; Google ignores llms.txt for ranking. https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google FAQ rich results were retired May 7, 2026. Keep human FAQ content; do not add markup to chase a retired feature. https://developers.google.com/search/updates
- Search crawler controls are distinct from model-training controls: https://developers.openai.com/api/docs/bots
- Accessibility target: WCAG 2.2 AA; automated checks are bounded evidence, not a full accessibility certification. https://www.w3.org/TR/WCAG22/

## Completion test

A pushed audit branch, one verified draft URL on the exact site, passing new-app build/lint/types/tests and accessibility checks, measured before/after evidence, complete static marketing batch, AUDIT-REPORT.md and DECISIONS.md copied to the output folder, exact gated release steps, and unchanged production deploy ID. No statement of commercial improvement without actual analytics.
