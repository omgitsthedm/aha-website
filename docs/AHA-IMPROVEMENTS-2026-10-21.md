# Approved website improvements — October 21, 2026

Scope: implement the 34 audited improvements using the October 21 research. Keep provider mappings, financial safeguards, approved artwork and the visual contract. Existing pending footer removal remains included. No paid test purchase or customer message.

Owner confirmed: contact-led exchanges/refunds within the existing 30-day window; no return shipment or vague production deduction. Passing the garment on is explained personally. Real order photos are not yet available and may follow shipped orders. Mobile owner can assist with a specific authentication prompt if one occurs.

Completion: code checks and focused browser/security tests pass; static/runtime markup matches; visual review completed; approved publication separately proven by exact release; external/physical evidence reported accurately.

| Audit item | State |
| --- | --- |
| A01 — Checkout errors | Built locally; checks passed |
| A02 — Bag initialization | Built locally; checks passed |
| A03 — Fit recommendation | Built locally; checks passed |
| A04 — Inconsistent garment color | Built locally; checks passed |
| A05 — Visible beanie label | Built locally; checks passed |
| A06 — Return promise | Built locally; checks passed |
| A07 — Clickable lookbook | Built locally; checks passed |
| A08 — Search | Built locally; checks passed |
| A09 — One Size | Built locally; checks passed |
| A10 — Color families | Built locally; checks passed |
| A11 — Filters | Built locally; checks passed |
| A12 — Addresses | Built locally; checks passed |
| A13 — Earlier express payment | Built locally; checks passed |
| A14 — Payment resilience | Built locally; checks passed |
| A15 — Bag focus | Built locally; checks passed |
| A16 — Units and profiles | Built locally; checks passed |
| A17 — Size guide | Built locally; checks passed |
| A18 — Physical product proof | Waiting for delivered garments; nothing invented |
| A19 — Campaign coverage | Built locally; checks passed |
| A20 — Motion mappings | Built locally; checks passed |
| A21 — Old CSS/snapping | Built locally; checks passed |
| A22 — Copy | Built locally; checks passed |
| A23 — Recommendations | Built locally; checks passed |
| A24 — Support | Built locally; checks passed |
| A25 — Account recovery | Built locally; checks passed |
| A26 — Funnel tracking | Built locally; checks passed |
| A27 — Field performance | Built locally; checks passed |
| A28 — Images/cache | Built locally; checks passed |
| A29 — Vendor scripts | Built locally; checks passed |
| A30 — Abuse/callback safeguards | Built locally; checks passed |
| A31 — Maintainability | Built locally; checks passed |
| A32 — Fulfillment truth | Catalog pipeline agrees; Apliiq dashboard read still needs the owner sign-in |
| A33 — Process wording | Built locally; checks passed |
| A34 — Image viewer | Built locally; checks passed |

## Working files and current state

Updated October 21, 2026 (Claude Code, after the Codex session ran out of usage mid-task).

- All code, copy, image and test changes live on branch `codex/footer-cleanup-2026-10-20` in the isolated checkout. Nothing is published; afterhoursagenda.com still serves commit `ea95917` (PR #147).
- Finishing work after the handoff: the GA4 tracking type error; the 15 regenerated beanie folded images and the Midnight back derivatives lacked the IPTC AI-source metadata (stamped losslessly, derivatives rebuilt at the catalog's WebP 82 / AVIF 60 settings); product pages were 828 bytes over the 65 KB script cap, so the checkout page's bag and payment script moved to `src/scripts/checkout.ts`, loaded only where `[data-checkout-page]` exists (product pages now load 50 KB, checkout 58 KB, both measured by `tests/artifact.test.mjs`); the blocked-storage bag bug has a browser test that fails without the in-memory bag; One Size pieces dispatch a change event on self-selection so GA4 `view_item` and the wallets start whichever module runs first; the local preview server answers `/api/checkout/config` with every wallet off; the phone size-filter row no longer overflows the viewport.
- Verified on Node 24.21.0: lint, typecheck, `npm audit` (0), preview build, production-mode build, 274 unit/artifact checks, 86 preview browser checks, 35 production-mode consent/express/checkout browser checks, and full-page screenshots of home, shop, beanie, Midnight long sleeve, returns, contact and bag at phone and desktop widths.
- Still outside this change: delivered-garment photos (A18), the Apliiq dashboard read for print methods (A32), and the owner's iPhone check of Safari scrolling and wallets on the hosted preview.
