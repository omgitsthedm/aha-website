# Design Tokens — After Hours Agenda

The AHA design system is **token-based** (per MASTER-UIUX-HANDOFF-v2 §E). Tokens live as CSS custom properties in `app/globals.css` `:root`, mirrored by the Tailwind theme in `tailwind.config.js`. **Do not hardcode hex/px in components — reference tokens.**

## Direction
Blacklight-grunge / 90s zine on near-black. Shipped and live — do not full-reset. Brand surfaces expressive; money/checkout surfaces calm.

## Color
| Token | Value | Use |
|---|---|---|
| `--aha-void` / `--aha-void-deep` | `#10100F` / `#070707` | page background |
| `--aha-charcoal` / `--aha-panel` / `--aha-panel-warm` | `#181816` / `#20201C` / `#2A241E` | surfaces/cards |
| `--aha-paper` / `--aha-paper-muted` | `#E9E1D4` / `#A9A093` | text / muted text |
| `--aha-lime` `--aha-cyan` `--aha-shock-pink` `--aha-electric-purple` `--aha-sunburst` `--aha-orange` `--aha-neon-green` | bright accents | block color, signals |

**Semantic (commerce):** `--aha-state-success` (green), `--aha-state-danger` (shock pink), `--aha-state-warning` (sunburst), `--aha-state-info` (cyan), `--aha-state-sold-out` (concrete). Never use color alone to convey status — pair with text/icon (WCAG).

## Type
- Display: `--aha-font-display` (Arial Black) — headlines/graphic moments.
- Body/utility: `--aha-font-grunge` (Courier New) — the shipped brand default.
- Mono: `--aha-font-mono` (IBM Plex Mono) — data/labels.
- Max two font families per surface; `font-display: swap`.

## Space / radius / border
4px scale `--aha-space-1..16`. `--aha-radius: 0` (hard blocks). `--aha-border: 4px`. `--aha-block-gap` for section rhythm.

## Motion
`--aha-motion-fast|base|slow` (150/220/300ms), `--aha-ease-out`. Zeroed under `prefers-reduced-motion`. No animation over 300ms; motion must earn its place.

## Accessibility constants
`--aha-tap-min: 44px` (min touch target). Focus ring: 3px cyan, 3px offset (in `:root` base). Contrast checked at token level (AA).

## Z-index
`--aha-z-nav|drawer|modal|toast` = 100/200/300/400.
