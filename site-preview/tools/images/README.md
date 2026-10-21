# AHA image pipeline

Garment shots are composites: a real blank-garment photo is recolored to the garment color and the approved print master is laid on it, shaded by the fabric. The artwork is only scaled and shaded, never redrawn, and `qa` checks its shape. Lifestyle shots are generated in batches from the composite as reference.

Run from `site-preview/` (Node 24.21.0). Every command prints one JSON line; outputs go to `tools/images/out/<slug>/` (not committed).

1. `node tools/images/cli.mjs knockout --in art.png --bg "#713238" --ink "#F9E5C3" --out print.png` turns single-ink art on a solid background into a transparent print master.
2. `node tools/images/cli.mjs compose --product <slug> --blank SS3000 --color "#5a1e2a" --art print.png --width 11 --top 3` makes the front and print-detail shots (stamped compositeSynthetic).
3. `node tools/images/cli.mjs qa --product <slug>` checks print-shape overlap (must be ≥ 0.90).
4. `node tools/images/cli.mjs generate --product <slug> --setting "…"` writes the lifestyle batch requests; add `--live` with `OPENAI_API_KEY` to render 3 candidates per shot (stamped trainedAlgorithmicMedia).
5. `node tools/images/cli.mjs review --product <slug>` serves http://127.0.0.1:48378/: A approve, R reject, arrows move.
6. `node tools/images/cli.mjs export --product <slug>` prints the `npm run catalog -- images …` command for the approved garment shots.

Bases live in `bases.json`:
- **Fronts:** SS3000, SS4500, AFX64CRP, CC4410, NL3601.
- **Backs:** SS3000, SS4500, CC4410, NL3601.

The SS3000, SS4500 and AFX64CRP fronts are 2080 px supplier photos. The rest are Apliiq's 590×900 neutral blanks, made for recoloring. The background must be pure white or transparent: only near-white connected to the edge counts as background, so fabric highlights stay garment. Folded views and lifestyle scenes still come from generation (`generate`, or another generator), with the exact print placed by `place`. Garment colors are approximate swatches until a photographed blank of that color is added.

## Existing SP12 and camo mockup corrections

`repair-mockups.py` fixes the native composite pipeline using the preserved source PNGs; it makes no AI calls. Its full embroidery regions protect the tops of every letter, with soft stitch edges and the complete private label. Do not replace these regions with a horizontal y=1000 cutoff. The camo masters are uniformly scaled to a common white canvas, silhouette width and hem baseline; garment proportions and artwork are never warped.

The four intact SP12 sources and the reviewed correction sheets are preserved locally in `After Hours Agenda/05 Website Mockups/2026-10-20 — Garment Corrections`. The corrected lossless masters and masks live in each affected product's `02 Garment Mockups/Website — Mockup Corrections` folder. Earlier files remain preserved. Run `python test_repair_mockups.py` with Pillow, numpy and scipy to verify that upper lettering retains its original thread pixels. The repair command requires explicit source, prior-master manifest and output paths; review masters before creating new versioned website exports.
