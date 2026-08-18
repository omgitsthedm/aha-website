# Self-hosted subsets

Google Fonts' latin files, cut down to what the storefront actually renders and
served through `next/font/local` (see `app/layout.tsx`).

| File | From | Subset | Size |
| --- | --- | --- | --- |
| `JetBrainsMono-400-latin.woff2` | JetBrains Mono v24 (OFL) | Basic Latin + `· © × é – — ‘ ’ “ ” • … →` | ~16 KB |
| `JetBrainsMono-700-latin.woff2` | JetBrains Mono v24 (OFL) | same | ~17 KB |
| `Oswald-700-latin.woff2` | Oswald v57 (OFL) | Basic Latin (care bar only) | ~7 KB |

Why: the Google-served JetBrains Mono file is a 31 KB variable font and Oswald
was 13 KB — both fetched at highest priority on every page and competing with
the hero image on the mobile critical path. Anything outside the subset falls
through to Menlo / Arial Narrow via `unicode-range`.

Rebuild (fonttools): `pyftsubset <src>.woff2 --unicodes="U+0020-007E,U+00A0,U+00A9,U+00B7,U+00D7,U+00E9,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026,U+2192" --flavor=woff2 --no-hinting --desubroutinize`.
