# After Hours Agenda audit and rebuild plan

October 9, 2026. Preview only. Supersedes the initial LFNYC rebrand direction following the user's explicit brand correction: custom-domain and client projects retain their own identity; only abstract projects use LFNYC branding.

## Verdict and scores

This is a maintained clothing website, not an abandoned agency template. Production shipped October 8 and its original suite passes 805 tests. The closed catalog exposes stale shopping copy and hides useful navigation. Node 20 is EOL, the development graph contains nine advisory entries, and documentation conflicts with current source. Keep After Hours Agenda, its approved art and its order-support boundary. Rebuild the public editorial experience as a small static preview while preserving the original commerce application and all provider data.

| Area | Before / 10 | Target / 10 |
|---|---:|---:|
| Stack and dependencies | 5 | 9 |
| Architecture and quality | 6 | 9 |
| UI and accessibility | 6 | 9 |
| UX and conversion | 5 | 8 |
| Performance | 9 | 9 |
| SEO readiness | 6 | 9 |
| AEO / GEO readiness | 5 | 8 |
| Content and context | 5 | 9 |
| Security and operations | 6 | 9 |
| AHA brand fidelity | 9 | 10 |

These are editorial assessments, not certifications. Matched original Lighthouse medians were already 100 performance on both device profiles. No improvement claim will be invented.

## Confirmed findings, ranked by impact

| Impact | Opened source / finding | Exact fix | Effort |
|---|---|---|---|
| P0 | The user's latest instruction rejects LFNYC branding on this custom-domain project | Replace the initial LFNYC draft with an AHA-branded site and correct every current review/marketing artifact | L |
| P0 | Root runtime/Netlify functions use Node 20, now EOL | Use the verified Node 24 / Astro 7 static preview, no functions; keep any production migration gated | M |
| P0 | Existing provider, payment, database and fulfillment paths are protected | Preserve original source and all live settings; ship no transactional code in the review artifact | M |
| P1 | components/ui/SiteNav.tsx gates editorial navigation on catalog availability | Always expose Story, Lookbook, Answers and Contact; verify native mobile menu and keyboard behavior | S |
| P1 | app/about/page.tsx promotes eight available products while catalog-policy closes sales | State the actual closed-catalog status; preserve historical imagery as archive rather than merchandise for sale | M |
| P1 | app/layout.tsx mounts global cart, tracking and platform clients on editorial pages | Static HTML, local fonts, responsive images, tiny menu/contact enhancements and no analytics in preview | M |
| P1 | Original full npm audit has nine development-chain advisory entries | Keep those out of the new artifact; maintain the independently audited zero-advisory preview graph | M |
| P1 | README, AGENTS, CLAUDE and SOURCE_OF_TRUTH contain old paths or initial LFNYC direction | Publish an exact branch/source/host contract for After Hours Agenda | S |
| P1 | July design docs conflict with the later source contract and app/layout.tsx | Preserve current CSS colors and Poppins 400/700/900; use plain hairline frames and the current warm voice, not retired folded surfaces or city claims | M |
| P1 | Preview needs clear indexing and contact boundaries | HTML + HTTP noindex, public review banner, contact draft only, no signup or send claims | S |
| P2 | Labels and contact/help copy use very small type | Minimum 12px metadata, 16px controls/body, 44px targets and visible focus; test 320px reflow | M |
| P2 | Imagery manifest flags AI placeholders and previous-run provider renders | Use existing brand-owned archive; label campaign concepts and previous-run renders visibly; fabricate no current-product proof | M |
| P2 | Old LCP budget allows 2750ms | Use current good threshold 2500ms, distinguish lab TBT from field INP, repeat matched measurements | S |
| P2 | Legacy process-local rate limit and scheduler-shaped manual request trust need operational ownership | Exclude every API/function from preview; retain production fixes/retirement as separate approval-scoped work | S |

## Rebuild order

1. Preserve the original checkout and production deploy. Keep audit/2026-10-09. Archive this task's superseded LFNYC materials inside its own evidence folder.
2. Rename the new package to site-preview; keep its tested current static architecture, headers, build guard and dependency isolation.
3. Rebuild AHA Home, Story, Lookbook, Manifesto, Contact, Updates, Answers, closed Shop, Privacy, Terms, Accessibility and a useful 404. Keep existing-order support and links to current shipping/returns information. Do not reopen shopping or alter order terms.
4. Use AHA's black sheep, paper/ink/rose tokens, Poppins and JetBrains Mono. Lead the homepage with the brand's existing words and a clearly identified campaign concept. Treat archive as archive.
5. Replace entity/contact/schema/OG/icon/manifest/llms metadata with AHA. No LFNYC service copy, client proof, phone or agency marks enter the artifact.
6. Validate lint, types, build, unit/artifact tests, browser routes, no-JS behavior, keyboard, contact error/draft/copy recovery, accessibility, headers and artifact identity. Add a regression assertion against wrong-business branding.
7. Commit and push the audit branch only. Replace the existing draft alias with the corrected artifact so the active review URL stops serving the superseded brand. No production promotion.
8. Verify hosted bytes and release marker, capture desktop/mobile and flows, and rerun matched Lighthouse profiles. Confirm production and main still match the original receipt.
9. Rebuild the complete static marketing batch using AHA branding and only final AHA measurements. Rewrite and print AUDIT-REPORT.md with the complete approval queue.

## Quick wins under one hour

- Restore permanent navigation and visible support.
- Correct closed-catalog claims and existing-order context.
- Replace every active LFNYC identity with the project's own AHA identity.
- Use local brand fonts, appropriately sized images and explicit image provenance.
- Keep noindex, strict CSP and a truthful email-draft flow.
- Correct source/host documentation and prepare gated release commands.

## Approval queue

No merge, production promotion, custom-domain/DNS change, paid service, provider/account/data changes, order/payment action or external send. Production migration from the existing Next application is a breaking deployment change and remains queued with exact commands. The review does not change historical order terms or automatically subscribe anyone. No global preferences or other projects are modified.

## Standards already verified October 9

Node 24 LTS / Node 20 EOL: https://nodejs.org/en/about/previous-releases
Astro 7: https://docs.astro.build/en/guides/upgrade-to/v7/
Core Web Vitals: https://web.dev/articles/vitals
WCAG 2.2: https://www.w3.org/TR/WCAG22/
Google AI guidance: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
Google documentation updates, including retired FAQ rich results: https://developers.google.com/search/updates
OpenAI search/training crawler controls: https://developers.openai.com/api/docs/bots
Google-Extended controls Gemini grounding and training: https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended

## Completion test

AHA identity on every shipped page and asset; current checks pass locally and in CI; one active corrected draft on the exact site; byte-verified hosted artifact; honest before/after numbers; complete unpublished AHA marketing batch; printed final report and approval queue; unchanged production and original checkout.
