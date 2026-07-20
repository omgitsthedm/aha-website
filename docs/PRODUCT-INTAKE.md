# Product Intake — design in, live product out

**Goal:** David hands Claude/Codex a design file + one line ("black women's tee, Black Sheep")
and the agent fills in everything and ships it live. This is the deterministic recipe.

Auto-publishes live — there is no review gate (David's choice). The Square item is created in
**production**. Be right the first time; a wrong detail is live until fixed.

---

## The one command

```bash
# 1. Load secrets (Printful + ops key live only in the gitignored .env.local)
set -a; . ./.env.local; set +a

# 2. Dry preview (nothing hosted/created) — always run this first to eyeball the plan
npm run product:new -- --art <file.png> --preset women-tee --name "Product Name" \
  --story "Two real sentences about the design."

# 3. Ship it — hosts art, creates Square item + mockups, writes data, pushes, verifies live
npm run product:new -- --art <file.png> --preset women-tee --name "Product Name" \
  --story "Two real sentences about the design." --live
```

That's the whole job. The wrapper hosts the art (public repo → instant raw URL for mockups,
durable site URL for fulfillment), runs `product-factory.mjs --live --push`, waits for the
Netlify deploy, and prints the live PDP URL + which grids it landed in.

### Flags
- `--art <file.png>` — the print-ready design (transparent PNG). **Or** `--art-url <url>` if already hosted.
- `--preset <name>` — see table below. Aliases work (`baby-doll`, `tee`, `sweatshirt`, …).
- `--name "…"` — customer-facing title. Slug is derived from it.
- `--story "…"` — 2+ sentences of real PDP copy (required to be ≥40 chars when set).
- `--colors Black,Bone` — optional; defaults to the preset (Black).
- `--sizes S,M,L,XL,2XL` — optional; defaults to the preset.
- `--price 3000` — optional cents; omit for auto (35% margin floor + $1, whole dollar).
- `--live` — actually host + create + push + verify. Without it: local preview only.

---

## Presets (`data/garment-presets.json`)

| preset | blank | gender | collection | default sizes |
|---|---|---|---|---|
| `unisex-tee` (alias `tee`) | Next Level 3600 | men/women/unisex | tees | S–2XL |
| `women-tee` (alias `baby-doll`, `fitted-tee`) | Gildan 64000L Women's | women | tees | S–2XL |
| `hoodie` (alias `pullover`) | Cotton Heritage M2580 | men/women/unisex | hoodies | S–2XL |
| `crewneck` (alias `sweatshirt`, `crew`) | Cotton Heritage M2480 | men/women/unisex | sweaters | S–2XL |

Each preset sets the Printful blank + `productType`/`category`/`gender`/`collectionIds`/size guide
so the product surfaces in `/shop` **and** the right gender + collection grids automatically.
To add a garment, append to `data/garment-presets.json` (verify the blank's Printful catalog
product id first) — no code change needed.

---

## What the agent fills in (and the rules)

- **Name** — real, on-brand, no niching the wearer. "after-hours" describes the maker, not the customer.
- **Story** — 2–4 honest sentences about the *design*. **Never** invent materials, collaborators,
  scarcity, stock counts, reviews, or origin claims (see repo `CLAUDE.md` → Content System). If you
  don't know a fact, don't state it.
- **Colors** — default Black; only add colors the blank actually offers.
- **Price** — leave auto unless David gives one. Auto never drops below the 35% margin floor.
- **Art** — must be the **print file** (the artwork itself on transparency), not a garment mockup.
  PNG, ≥1800px on the longest side (1200px hard floor). The factory rejects anything smaller.

---

## Definition of done

The `--live` run ends with `✅ LIVE — https://afterhoursagenda.com/product/<slug>` and a grid line
like `/shop:✓  /women:✓`. If any grid shows `✗`, the taxonomy is off — check the preset's gender.
Then spot-check the PDP: image renders, price is right, Add to Bag works.

---

## Troubleshooting

- **`PRINTFUL_API_TOKEN required`** → you didn't source `.env.local` (`set -a; . ./.env.local; set +a`).
- **`OPS_MAINTENANCE_KEY required`** → same; the ops key creates the production Square item.
- **`art is …px — hard floor 1200px`** → the design is too low-res to print. Get a bigger export.
- **`unknown preset`** → use one from the table (or add it to `data/garment-presets.json`).
- **PDP not live yet** → Netlify build still running; re-check the URL in a minute. The product
  already exists in Square + the data is pushed; only the deploy is pending.
- **Back-view / on-model shots** → not automatable; the factory attaches Printful flat mockups.
  Curate hero imagery separately.

---

## For Codex

Identical command. Just ensure you `cd` to the repo root and source `.env.local` first. The wrapper
does its own git commits (art asset, then the product data) and pushes to `main`; don't wrap it in a
separate branch/worktree — it publishes to production by design.
