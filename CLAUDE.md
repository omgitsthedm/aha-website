# After Hours Agenda

Read `AGENTS.md` and `SOURCE_OF_TRUTH.md`. This is a custom-domain clothing-brand project and must remain After Hours Agenda. The October 9 correction supersedes the initial LFNYC rebrand direction.

The active review app is `site-preview/` (Astro 7.3.8, Node 24.21.0); the root Next.js commerce app and production config are preserved. Work only in the isolated `audit/2026-10-09` worktree. Run `npm run check`, `npm run test:e2e` and `npm audit` inside the new package. Use installed Chrome and ports 48378/48379.

The preview is static and non-transactional. It prepares email drafts to AHA support, labels concept/archive imagery, and states that new orders are paused. It does not send, subscribe, query customer records or accept payment. No merge, production promotion, provider/data change or external send is authorized. Exact release preparation is in `NEEDS-APPROVAL.md`; measured evidence is in `AUDIT-REPORT.md`.
