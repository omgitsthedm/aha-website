# AFTER HOURS AGENDA — OPERATIONS HANDBOOK
**Version 1.0 — 2026-07-14. This is the controlling operational document.**
Written so ANY model or agent can operate this store safely by following it literally.
If this document conflicts with older docs, THIS DOCUMENT WINS. If you cannot satisfy
a rule, STOP and report — do not improvise around it.

---

## 0 · Identity (copy these values exactly — never guess)

| Fact | Value |
|---|---|
| Live site | https://afterhoursagenda.com |
| Repo | `github.com/omgitsthedm/aha-website`, branch `main` |
| Working directory | `~/Desktop/LiFi NYC/Clients/After Hours Agenda/aha-website` |
| Netlify project / site id | `afterhoursagenda` / `275b4115-16bf-42fb-9b36-6bce9bb93608` |
| Payments truth | Square (production) |
| Fulfillment | Printful, store id `14298228` (Square platform store) |
| Support identity | info@afterhoursagenda.com |
| Brand name in public | `After Hours Agenda` — NEVER the abbreviation "AHA" in anything customer-facing |

## 1 · Laws (absolute — violating any of these is a failed task)

1. **Never break Cart → Checkout → Payment → Confirmation.** Any change touching
   `lib/square/`, `lib/printful/`, `lib/commerce/`, `app/api/`, `app/cart/`,
   `components/checkout/` requires: typecheck + lint + `npm test` + `npm run validate:all`
   ALL green before commit.
2. **Never confirm a Printful order manually.** Draft orders for testing are allowed
   and must be DELETED after. Confirmation happens only inside the production
   payment flow behind `PRINTFUL_ALLOW_CONFIRM_ORDERS` + `PRINTFUL_LIVE_MODE`.
3. **Never hardcode prices, product ids, or inventory.** Square prices at request
   time; the data maps carry fulfillment DNA.
4. **35% margin floor.** No active variant may price below `ceil(cost / 0.65)`.
   The tooling throws; never override it. Pricing above the floor is David's decision.
5. **Honesty:** no fake urgency, scarcity, reviews, invented materials or origin
   stories, and **no synthetic humans presented as people wearing the product**.
   Real-model Printful photography and real customer photos only.
6. **Copy law:** "after-hours" describes the maker, never prescribes the wearer.
   Never niche the customer (no "for night-shift workers", no persona copy).
7. **Color law:** rose is the brand and stays. Fills: `#FF6B6B` with ink `#1A1A1A`
   text. Rose TEXT on white: `#CE3D56` (`text-accent`). On grey `#F1F1F1` panels:
   `#B03246`. Fix contrast by changing the PAIRING, never by removing the color.
8. **Fulfillment routing:** `lib/commerce/fulfillment-state.ts#buildStoreOrderRequest`
   decides v1 vs v2 per store batch (v2 rejects sync items as of Jul 2026).
   NEVER bypass or "simplify" it.
9. **Storefront hides Square items with no image.** Never create an item without
   attaching at least one image.
10. **Secrets:** production Square/Printful credentials exist ONLY in Netlify env.
    Square writes go through the key-guarded `/api/ops/*` endpoints
    (`OPS_MAINTENANCE_KEY` in gitignored `.env.local`). Never print a token, never
    commit one, never weaken an ops guard.
11. **Deploys are git-backed.** Push to `main` → Netlify builds. No manual deploys
    except a David-approved emergency restore. After deploy:
    `LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live`.
12. **Mobile is part of done.** Verify changed surfaces at iPhone width (390px)
    before claiming completion. Touch targets ≥ 44px.
13. **Kids/all-ages gate:** NOTHING family/kids-facing ships without the complete
    compliance record per SKU (age range, approved blanks, flammability/lead/
    tracking-label, eligible art). No exceptions.
14. **When uncertain, stop and report.** A wrong guess in production commerce is
    worse than a question.

## 2 · Standard operations (exact commands)

All commands run from the working directory. `PRINTFUL_API_TOKEN` and
`OPS_MAINTENANCE_KEY` must be in the environment (`.env.local` has the ops key).

**Add a new product** (any technique — dtg, embroidery, cut-sew, sublimation, uv, sticker):
1. Put the design PNG (≥1800px longest side) in `public/printful-assets/`, commit, push, wait for deploy.
2. Write a spec (see `docs/product-factory.md` — REQUIRED reading): name, artUrl,
   `garmentCatalogProductId`, colors/sizes, `story` (2+ real sentences), price in cents.
3. Dry-run: `node scripts/product-factory.mjs --spec spec.json`
4. Review the printed costs/floor. Then: `node scripts/product-factory.mjs --spec spec.json --live --verify-draft`
5. `npm run validate:all` → commit `data/` changes → push → verify the PDP live.

**Resurrect a product:** `node scripts/product-factory.mjs --resurrect <slug> --price <cents> --live`
(per-size pricing: `--price-map '{"SIZE":cents}'`).

**Change print art on existing products:** update the map, then
`node scripts/fix-rebuild-positions.mjs --live --verify` (recomputes positions
from real print areas + art ratios and draft-verifies each product).

**Attach/refresh product images:** `node scripts/attach-rebuild-mockups.mjs --live`
or the on-model pipeline `node scripts/generate-onmodel-shots.mjs` (real-model
photography; raw art comes from sync-variant files, NEVER the asset exports).

**Provider health:** `npm run audit:provider-liveness` (discontinued blanks,
dead sync variants). Run after any Printful surprise and before big pushes.

**Deploy + verify:**
```
npm run typecheck && npm run lint && npm test && npm run validate:all
git push origin main        # triggers the build
npm run verify:netlify-site
LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live
```

**Database:** schema in `db/schema.ts`; `npm run db:generate` writes a migration to
`netlify/database/migrations/` which auto-applies on deploy. Never edit applied migrations.

**Watched-blank webhooks:** after adding a product on a NEW blank, re-register
`catalog_stock_updated` params (see `docs/product-factory.md` → Provider signals).

## 3 · Verification gates (run before saying "done")

- [ ] typecheck, lint, unit tests, `validate:all` all green
- [ ] live smoke: `/`, `/shop`, one PDP, `/track-order` return 200
- [ ] purchase-flow probe if commerce was touched: POST `/api/checkout-quote`
      with a real variation id returns `ok: true`
- [ ] mobile width screenshot of changed surfaces
- [ ] report: what changed · files touched · tests run · risks · remaining gaps · next step

## 4 · Known gaps (carry-forward backlog — July 14, 2026)

**Needs David only:**
- Printful File Library sweep (dashboard-only, cosmetic — old sheep files)
- Real campaign photography (brief: `../BRAND-BRIEFS-2026-07-13.md`)
- Black sheep character system (trademark check, human redraw) — same brief
- Wordmark artist curve-pass before trademark filing/embroidery
- Pricing ladder review (basic tees $47–49 vs core $40 — inverted; David deferred)
- Zip-hoodie art remap decision (Classic AHA, Splatter — blank discontinued;
  deny-defend-depose sweatshirt drafted for the same reason)
- Codex design branch `design/origami-storefront-polish-20260713`: review or delete
- Copy book read-through (`../WEBSITE-COPY-BOOK-2026-07-13.md`)
- Fonts/palette print + fabric sign-off; release rhythm; social channels
- GA4/GTM measurement id (see analytics gap below)

**Buildable without decisions:**
- **Analytics is dark:** `trackCommerceEvent` pushes to `window.dataLayer` but no
  GA4/GTM script loads — funnel events go NOWHERE. Blocked only on a measurement id.
- Back/detail views for ~40 single-image PDPs (local library has more angles)
- Colorway chips (swatch dots) on grid cards
- LCP 2.1s → <2.0s (hero preload tuning)
- Uptime/error alerting (nothing pages anyone if checkout 500s)

**Gated programs (in order):** All-Ages classification → Kids line (full compliance
gate) → verified reviews infra → dark mode (optional) → packaging system →
digital gifts → wholesale kit.

## 5 · Escalation triggers (stop work, report to David)

- Any Printful/Square API behavior that contradicts this handbook (they change APIs
  without notice — Jul-14 precedent: v2 silently dropped sync orders)
- Any request to publish synthetic humans, fake reviews, scarcity, or prices below floor
- Anything touching live customer data, refunds, or order cancellation
- Legal/trademark questions (sheep character, wordmark)
- Spending money beyond normal order-fulfillment mechanics
