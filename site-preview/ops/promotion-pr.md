Replaces the current After Hours Agenda public runtime with the reviewed AHA static editorial website, after explicit approval of the deployment and feature changes. The brand and custom domain remain After Hours Agenda. The build base becomes `site-preview`, and the artifact ships no commerce functions, database queries, tracking or automatic submissions.

The preview covers 16 public pages plus a 404, accessible navigation, honest closed-catalog information, captioned archive/concept imagery and an email-draft support flow. Existing order terms are preserved. `AUDIT-REPORT.md` records the exact draft, measurements and checks.

This is a breaking runtime migration: newsletter subscriptions, automated order lookup and operational/provider endpoints are excluded from the static application. Before this PR is approved, either explicitly accept that reduced runtime or prepare a separate verified backend-preservation plan. No original provider data or account is deleted. The existing Next.js build plugin must be disabled for exact site `275b4115-16bf-42fb-9b36-6bce9bb93608` before activating the static build.

Production publishing is the Git-connected main build after explicit approval, never manual promotion of the noindex review artifact. No DNS change, different business identity or other project's change is part of this migration.
