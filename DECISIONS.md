# Decisions — After Hours Agenda — 2026-10-09

## Current decisions after the user's brand correction

- Custom-domain and future-client projects keep their own identity; only abstract projects use LFNYC branding. This project stays After Hours Agenda.
- The active package is `site-preview/`; the earlier LFNYC direction and local review assets are preserved only as superseded history under this task's evidence folder and Git history.
- Keep the existing draft alias so its active contents are replaced; the alias's historical LFNYC prefix is not the website's brand.
- AHA's current CSS, Poppins 400/700/900, JetBrains Mono, black sheep and warm voice override conflicting older design prose; no agency marks, services or client work enter the site.
- Ship 16 public editorial/support pages plus a 404, including closed Shop, Shipping, Returns, Track Order guidance, Size and Care; retain original purchase terms and claim no current stock or future release date.
- Existing campaign concepts, previous-run renders and brand archive keep visible provenance captions; do not present placeholders as product photography.
- Keep static, local email drafts for preview. Automatic newsletter signup, order lookup and provider endpoints are excluded; production replacement requires explicit acceptance or a separate backend-preservation plan.
- Reuse the unmodified current AHA social card and icons; the existing branding is correct and does not need an invented replacement.
- The corrected preview uses the same current, pinned, zero-advisory toolchain; repeat validation, hosted screenshots and measurements for AHA rather than reusing superseded LFNYC results.
- A file read initially referenced absent historical filenames; canonical source paths resolved the questions without creating or modifying those files.

## Earlier execution record — superseded where it conflicts with the decisions above

- Use current GitHub main `c682761` as baseline in an isolated worktree; preserve the original checkout and unmerged branch commits.
- Rebrand the requested preview as LFNYC while retaining the AHA application and providers unchanged; `lfnyc/` is the only preview publish source.
- Use Astro 7 static HTML and Node 24 LTS; service pages need no server, database, cart, framework hydration, analytics or consent banner.
- Use the complete supplied LFNYC Brand Kit: midnight ground, orange action, supporting blue, Oswald/Barlow/JetBrains Mono, unmodified fixed-color tugboat assets.
- Follow the linked canonical design contract for commercial hierarchy; websites first, urgent support second, consulting free, software you own as the deeper service.
- Use supplied business photography as illustrative brand imagery, never as a claimed client location or outcome.
- Use published LFNYC work only after verifying current public evidence; invent no reviews, prices, dates, revenue, rankings or results.
- Use an explicit email-draft contact flow with local validation and phone/email fallbacks; do not connect the preview to AHA's forms, email or customer database.
- Preview origin is `https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app`; noindex is an indexing directive, not access control.
- Keep llms.txt as an accurate optional summary requested by the user; Google does not use it for ranking and no AI citation outcome is promised.
- Publish plain answers without FAQ/HowTo rich-result promises; current Google documentation retires FAQ rich results.
- Use project-local tooling and non-default ports 48378/48379; no global installs, shared configuration changes or personal Chrome profiles.
- Build hook rejected a dependency command despite an exact workdir; explicit `cd` to the worktree resolved it without approval or global changes.
- Screenshot URL pathname encoding initially placed this task's captures in a percent-encoded folder; moved only those generated files into the exact output path and corrected fileURLToPath usage.
- Lighthouse required its custom profile directory to exist; create task-local profile directories explicitly before launch.
- TypeScript 7.0.2 is newer but unsupported by current @astrojs/check; pinned supported TypeScript 6.0.3 instead of forcing peer dependencies.
- Installed current Astro 7.3.8, ESLint 10.12.0, Astro ESLint 3.2.1, Playwright 1.64.0 and axe-core 4.14.0; initial complete new-app audit reports zero vulnerabilities.
- Baseline Lighthouse is already excellent; final performance scoring uses measured results and does not claim the old site was slow.
- Lighthouse programmatic preset flags did not change the desktop form factor; switched to the official desktop config and reran matching verified profiles.
- The first failed Lighthouse launch left only this task's Chrome process; stopped that verified PID, preserved other project/browser sessions, and relaunched.
- Sharp's current package no longer exposes the historical lib/index.js path; resolved its public package entry instead.
- Port 4388 was occupied by another local project; selected dedicated ports 48378/48379 without stopping or inspecting that project.

- Browser checks found an intrinsic-size grid overflow and a closed-menu layout leak; fixed both and retained 320px reflow coverage.
- Lazy images are verified after scrolling into view; a full-page capture alone does not trigger every lazy image.
- The release digest includes headers, crawler files and metadata as well as page assets, excluding only release.json to avoid self-reference.
- Local Lighthouse exposed oversized mobile images and an uncompressed local test server; added responsive WebP sizes and local text compression before the hosted candidate.
- Allow same-origin connections in CSP so browser inspection can read robots.txt; cross-origin connections remain blocked, form-action remains none, and tests still prove the brief makes no submission.
- Gitleaks is not installed; used a redacted known-credential-pattern scan of new source and artifact, plus dependency and artifact-boundary tests, without claiming a full security certification.
- Netlify still reports the Next.js build plugin; the queued production migration explicitly disables that exact plugin before activating the static build. Draft deploys bypass builds and inherit no function bundle.
- Added the official SIL Open Font License notices for the three supplied font families; the supplied files remain unmodified.
- Locally tested the approval-gated production build: production canonicals, indexing directives and social card switch correctly, with no preview banner; restored the noindex draft artifact and uploaded no production build.
- Clean GitHub CI exposed @typescript-eslint/parser being resolved from the preserved parent install; pinned parser 8.71.1 directly in the new package and reran the clean CI job.
- CI also exposed inherited Node type declarations; pinned the Node 24 types and restricted compiler ambient types, then verified the app in a separate clean install outside the legacy dependency tree.
- Current Google documentation says Google-Extended controls Gemini grounding as well as training; the reviewed preview blocks it, while the separately approved production build allows it to support the requested Gemini visibility. GPTBot and ClaudeBot training access remain blocked.
- Netlify CLI rejected --context with --no-build before creating a deploy; removed the incompatible context flag and retained the explicit draft alias, exact site ID, prebuilt directory and empty functions.
- Corrected the provisional before-performance score from 6 to 9 after matched baseline Lighthouse runs showed 100 median performance on mobile and desktop; the final comparison does not manufacture an old speed problem.
- Final hosted medians use three matching Lighthouse 13.5.0 runs per device and version; field CWV, conversions and AI citations are not claimed.
- The single successful draft is 6ac8a497d59c076a602798ad, with no functions/plugins/database work and no production publication; subsequent documentation commits do not trigger another deploy.
- A direct host-verification script initially used the Playwright response-status method on the Fetch API; corrected it to the status property and reverified all 58 public files successfully.
- Static graphics are rendered from the approved fonts/marks and actual screenshots; added a compositor-settle step after visual inspection caught incomplete text painting in two initial exports.

- The user corrected brand scope: custom-domain and future-client projects keep their own identity; this project remains After Hours Agenda, and the initial LFNYC draft/package is superseded.
- Use current AHA CSS and the later source contract when July design docs conflict: Poppins 400/700/900, paper/ink/rose, hairline frames and warm clothing-brand copy.
- Retain the existing draft alias only to replace its active contents; its earlier LFNYC label is a technical URL history, not the business identity.
- Final diff verification initially ran from the output folder instead of the worktree; corrected the directory before any Git mutation.
- Git diff review caught trailing whitespace in the official Poppins license; normalized whitespace only and preserved all license wording.
