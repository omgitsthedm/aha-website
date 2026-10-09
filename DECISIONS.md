# Decisions — 2026-10-09

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
- Use project-local tooling and non-default ports 4387/4388; no global installs, shared configuration changes or personal Chrome profiles.
- Build hook rejected a dependency command despite an exact workdir; explicit `cd` to the worktree resolved it without approval or global changes.
- Screenshot URL pathname encoding initially placed this task's captures in a percent-encoded folder; moved only those generated files into the exact output path and corrected fileURLToPath usage.
- Lighthouse required its custom profile directory to exist; create task-local profile directories explicitly before launch.
