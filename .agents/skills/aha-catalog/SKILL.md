---
name: aha-catalog
description: Add, check or publish After Hours Agenda products (Apliiq design → Square item → website) with the catalog engine. Use for any new design, garment, color, price or catalog drift question on afterhoursagenda.com. Works the same in Codex and Claude Code.
---

# AHA catalog engine

One command does each step. Read its single JSON line; open `site-preview/tools/catalog/logs/*.jsonl` only if you need details. Never re-derive provider payloads by hand and never write ad-hoc scripts for a product.

Run everything from `site-preview/` with Node 24.21.0.

Credentials live outside the repo in `~/.config/aha/provider-credentials.env` (Apliiq key and secret, Square token, admin automation token). Load them per command and never print them:

```bash
node --env-file="$HOME/.config/aha/provider-credentials.env" tools/catalog/cli.mjs <command>
```

## Fastest path: one command

`ship` turns approved work into a live-ready commit:
1. It pulls admin publish requests and checks margin and images: four garment views, plus three campaign photos from one setting.
2. It plans, applies (Apliiq design and Square item), and syncs every gallery photo to Square.
3. It builds, verifies, runs the tests, and commits on a `catalog/<date>-<slug>` branch.

4. With `ADMIN_AUTOMATION_TOKEN` set, it publishes each product live: images, then product, then a check that its page answers. Add `--no-live` to skip this.

The product is then on sale with no site build. Push the branch and open a PR so the next build serves it statically; that PR goes out with the next code change and needs no release of its own. Images come from `tools/images` (see its README): `compose` for exact-print garment shots, `place` to put the exact print on generated lifestyle photos.

## Token budget

- One drop (design → live) should take one short session. Read each command's single JSON line, not the logs.
- If a drop needs more than about 15 tool calls or one retry of the same step, stop and tell the owner what is blocking.
- `npm run catalog -- usage` shows time and provider calls per command.


## Flow from the admin (Apliiq "Add to Store")

1. The owner designs in Apliiq and presses **Add to Store** (custom store). A draft appears in `/admin/products/`.
2. The owner sets title, color, garment (blank), collection, slug and retail price, approves, then presses **Publish**.
3. You run `npm run catalog -- pull` with `ADMIN_AUTOMATION_TOKEN` set. Each publish request becomes `catalog/designs/<slug>.json` (approved, existing Apliiq design, gallery built from the Apliiq mockups).
4. Replace mockups with real garment images when available: `npm run catalog -- images <slug> --files front.jpg back.jpg detail.jpg folded.jpg`.
5. Then margin → plan → apply → verify → release, as below. Apply skips Apliiq creation for these and reports the publish request done.

## Flow for a new product

1. **Design spec.** Copy `catalog/designs/_template.json` to `catalog/designs/<slug>.json` and fill every TODO from what the owner approved (art, blank, color, sizes, price, copy, images). One file per garment/color.
2. **Margin.** `npm run catalog -- margin <slug>`. Exit 5 means a size is below the floor in `catalog/costs.json`. Refresh `costs.json` from a current Apliiq quote before each drop; costs change without notice.
3. **Approval gate.** Only the owner approves. Set `"status": "approved"` and `approval.by` / `approval.at` / `approval.note` with their exact words. Never approve on their behalf.
4. **Plan.** `npm run catalog -- plan`. It writes a hashed plan file and lists any open gates. Show the owner the plan summary.
5. **Apply.** `npm run catalog -- apply --plan <file>` with `AHA_APLIIQ_API_KEY`, `AHA_APLIIQ_SHARED_SECRET` and `AHA_SQUARE_ACCESS_TOKEN` in the environment (never print them). It creates the Apliiq artwork and design (label SB-3-161622 / 6208403, inside neck), creates or adopts the Square item, verifies the readback, then updates `catalog/ledger.json`, `src/data/products.json` and the generated `server/fulfillment/catalog.mjs`.
6. **Verify.** `npm run build` then `npm run catalog -- verify` (exit 2 = drift). Then `npm test`.
   A new collection leads the home page, shop and lookbook only after you add its name to the front of `COLLECTION_ORDER` in `src/data/collections.ts`; otherwise it follows the listed ones.
   Run `npm run images:placeholders` so its campaign photos get loading placeholders; `tests/premium.test.mjs` fails until they have them.
7. **Release** through the normal PR → required checks → merge → exact-site Netlify deploy. Never deploy from a branch.

## Rules that never bend

- **Apliiq has no sandbox and no idempotency key.** Every create writes an intent in `catalog/intents/` first. If an intent is `pending`, `uncertain` or `rejected`, stop: check the Apliiq dashboard for a matching design, then mark the intent complete with the real response or delete it. Never retry blindly.
- A wrong Apliiq signature returns HTTP 500, not 401. Check credentials before assuming an outage.
- Changing a design in Apliiq creates new SKUs. Treat it as a new design and new Square variations; never edit SKUs by hand.
- `server/fulfillment/catalog.mjs` is generated. Edit the ledger through the engine, then `generate`.
- No paid test orders, emails, ads or provider deletions without the owner's explicit instruction.
- Lifestyle/campaign images never go in shopping galleries or feeds.

## Other commands

- `npm run catalog -- verify`: ledger ↔ products.json ↔ allow list ↔ built feeds.
- `npm run catalog -- explain <slug>`: ledger entry, site status, spec status and intents for one product.
- `npm run catalog -- square-images <slug>`: upload any gallery view Square doesn't have yet.
- `npm run catalog -- publish-live <slug>` / `unpublish-live <slug>`: put an applied product on the live site without a site build, or take it down.
- `npm run catalog -- usage [days]`: runs, time and provider calls per command.
- `npm run catalog -- retire-sync`: products the owner removed in the admin leave products.json, the ledger (status `retired`) and the allow list, so the next build drops their pages. Products with unshipped orders wait. Commit and open a PR afterwards.
- `npm run catalog -- square-skus [--apply]`: report, or fix, Square variation SKUs that differ from the ledger (the daily check flags this).
- `npm run catalog -- generate`: rewrite the allow list from the ledger.
- `npm run catalog -- import`: one-time adoption of an existing catalog (already done Oct 16, 2026).

Exit codes: 0 ok · 1 error · 2 drift · 3 missing credentials · 4 blocked intent · 5 margin or approval gate.
