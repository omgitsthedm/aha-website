# AHA image pipeline

Garment shots are composites: a real blank-garment photo is recolored to the garment color and the approved print master is laid on it, shaded by the fabric. The artwork is only scaled and shaded, never redrawn, and `qa` checks its shape. Lifestyle shots are generated in batches from the composite as reference.

Run from `site-preview/` (Node 24.21.0). Every command prints one JSON line; outputs go to `tools/images/out/<slug>/` (not committed).

1. `node tools/images/cli.mjs knockout --in art.png --bg "#713238" --ink "#F9E5C3" --out print.png` turns single-ink art on a solid background into a transparent print master.
2. `node tools/images/cli.mjs compose --product <slug> --blank SS3000 --color "#5a1e2a" --art print.png --width 11 --top 3` makes the front and print-detail shots (stamped compositeSynthetic).
3. `node tools/images/cli.mjs qa --product <slug>` checks print-shape overlap (must be ≥ 0.90).
4. `node tools/images/cli.mjs generate --product <slug> --setting "…"` writes the lifestyle batch requests; add `--live` with `OPENAI_API_KEY` to render 3 candidates per shot (stamped trainedAlgorithmicMedia).
5. `node tools/images/cli.mjs review --product <slug>` serves http://127.0.0.1:48378/: A approve, R reject, arrows move.
6. `node tools/images/cli.mjs export --product <slug>` prints the `npm run catalog -- images …` command for the approved garment shots.

Bases live in `bases.json` (SS3000 and AFX64CRP front so far). Back and folded views, and SS4500/NL3601/CC4410 fronts, need a blank photo added there. Garment colors are approximate swatches until a photographed blank of that color is added.
