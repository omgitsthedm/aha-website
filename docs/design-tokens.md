# After Hours Agenda Design Tokens

Regenerated: 2026-07-27, read directly out of `app/globals.css` and `tailwind.config.js`.

> **If you are holding an older copy of this file, discard it.** Every version
> before this one described a dark theme with Arial Black display type and IBM
> Plex Mono body type. That system was replaced by the light Origami Geométrico
> ground two days after it was written, and this file was never updated — it
> spent a year telling contributors the opposite of what shipped. Nothing below
> is aspirational; each value was copied out of the source.

**Source of truth order.** `app/globals.css` holds the primitives. `tailwind.config.js`
maps a subset onto semantic Tailwind names. `docs/AHA-DESIGN-SYSTEM.md` is the
controlling *visual system* (principles, composition, surface behaviour); this
file is the *value contract*. If they ever disagree, the CSS wins and both docs
are wrong.

Components must not introduce raw colour values. Add a token instead.

---

## Colour

### Primitives — `app/globals.css` `:root`

| Token | Value | Use |
|---|---|---|
| `--aha-ink` | `#1A1A1A` | primary text, borders at full strength |
| `--aha-paper` | `#FAFAFA` | the storefront ground |
| `--aha-surface` | `#FFFFFF` | raised panels (`fold-surface`) |
| `--aha-surface-raised` | `#F1F1F1` | sunken/tinted panels |
| `--aha-paper-muted` | `#4A4A4A` | supporting text |
| `--aha-line` | `#B0B0B0` | **decorative** hairlines only |
| `--aha-control-border` | `#8A8A8A` | the edge of an interactive control |
| `--aha-rose` | `#FF6B6B` | rose as a **fill**, ink text on top |
| `--aha-accent` | `#CE3D56` | rose as **text**, and focus rings |
| `--aha-sky` | `#87CEEB` | fold-plane wash |
| `--aha-success` | `#166534` | confirmed success only |
| `--aha-warning` | `#8A5A00` | recoverable attention state |

### Semantic channels → Tailwind

The `--c-*` variables are space-separated RGB triplets so Tailwind can apply
`<alpha-value>`. Write `text-accent`, `border-border/60`, `bg-void` — not the
raw variable.

| Tailwind | Channel | Resolves to | Use |
|---|---|---|---|
| `void` | `--c-bg` | `#FAFAFA` | page ground |
| `charcoal` | `--c-charcoal` | `#F1F1F1` | sunken panel |
| `surface` | `--c-surface` | `#FFFFFF` | raised panel |
| `cream` | `--c-content` | `#1A1A1A` | primary text |
| `border` | `--c-content` | `#1A1A1A` | rules and control edges, always with alpha |
| `muted` | `--c-muted` | `#4A4A4A` | supporting text |
| `accent` | `--c-accent` | `#CE3D56` | accent text and focus, **on paper** |
| `accent-sunken` | `--c-accent-on-sunken` | `#B8304A` | accent text **not** on paper |
| `rose` | `--c-rose` | `#FF6B6B` | accent fills and selected states |
| `success` | `--c-success` | `#166534` | success text |
| `warning` | `--c-warning` | `#8A5A00` | warning text |
| `danger` | `--c-error` | `#CE3D56` | blocking failure |
| `error` | `--c-error` | `#CE3D56` | compatibility alias for `danger` — do not reach for it in new code |

**Three Tailwind names are historical and mean the opposite of what they say.**
`void` is the paper white, not a void. `cream` and `border` are ink black. They
survive because renaming them touches every file in the storefront; they are a
naming debt, not a second palette. Read the "resolves to" column, not the name.

### Contrast rules that are not optional

- **Rose text is never `#FF6B6B`.** On paper white that is 2.5:1. Rose text is
  `--aha-accent` `#CE3D56` (4.55:1). `#FF6B6B` is a fill with ink on top (6.15:1).
- **Accent text on a tinted panel is `accent-sunken`.** `#CE3D56` on
  `#F1F1F1` measures 4.20:1 and fails AA. `#B8304A` measures 5.2:1 there.
- **A control's border is not `--aha-line`.** Where the border is the only thing
  identifying an interactive control, WCAG 1.4.11 wants 3:1. `#B0B0B0` on paper
  is 2.08:1; `--aha-control-border` `#8A8A8A` is 3.31:1. `--aha-line` stays for
  section dividers, `fold-surface` edges, the scrollbar thumb and disabled
  chrome, all of which 1.4.11 exempts.
- **Alpha decides whether `border-border` is legal on a control.** Composited on
  paper: `/60` → `#747474`, 4.48:1 (safe on a control edge or a selected state);
  `/40` → `#A0A0A0`, 2.51:1; `/10` → 1.22:1. `/40` and below are *decorative*
  alphas — section rules, dividers, image frames. Never use them as the border
  that identifies a control or distinguishes selected from unselected.
- **Status is never carried by colour alone** — always a word as well.

### Retired values

`#A8D5BA` (sage) and `#F0C987` (warm crease) were once the success and warning
tokens. On paper they measure ~1.5:1. They are retired **for status** and must
not return through that door. They survive legitimately as low-opacity
fold-plane washes and in the transactional email colour band, where they are
decoration on a dark ground.

---

## Type

Both faces load through `next/font/google` in `app/layout.tsx`, at weights
**400 and 700 only**. Do not write `font-medium`, `font-semibold` or
`font-extrabold` — there is no such file to load, and the browser will
synthesise it.

| Token | Tailwind | Stack |
|---|---|---|
| `--aha-font-display` | `font-display` | Poppins, Arial, sans-serif |
| `--aha-font-body` | `font-body` | Poppins, Arial, sans-serif |
| `--aha-font-mono` | `font-mono` | JetBrains Mono, Menlo, monospace |

Poppins drives display and body. JetBrains Mono is reserved for metadata,
labels, prices and technical values.

### Size scale

| Tailwind | Value | Job |
|---|---|---|
| `text-eyebrow` | `10px` | mono uppercase metadata |
| `text-label` | `11px` | mono uppercase control and chrome labels |
| `text-base` | `1rem` | body copy (Tailwind default) |
| `text-display-sub` | `clamp(1.5rem, 4vw, 2.5rem)` | sub-headings |
| `text-display-section` | `clamp(2rem, 5vw, 3.5rem)` | section headings |
| `text-display-hero` | `clamp(2.75rem, 8vw, 5.5rem)` | page and hero headlines |

| Tailwind | Value |
|---|---|
| `tracking-display-tight` | `-0.05em` |
| `tracking-display` | `-0.03em` |
| `tracking-label` | `0.06em` |
| `tracking-caps` | `0.08em` |
| `tracking-eyebrow` | `0.1em` |

The scale is new and adoption is partial: much of the storefront still writes
arbitrary `text-[clamp(…)]` and `tracking-[…]` values. New work uses the named
tokens. Migrating the existing call sites is tracked separately, because it
changes rendered sizes and needs a visual diff at 375 / 768 / 1280.

### Two size floors you cannot override casually

- **Form controls are floored at 16px.** `input`, `select` and `textarea` carry
  `font-size: max(16px, 1em)` behind a `:not()` selector in `globals.css`. iOS
  zooms the viewport when a focused field is under 16px. The `:not()` is
  load-bearing specificity, not decoration — read the comment before touching it.
- **Button labels come from `--btn-font-size`.** `.btn-primary` / `.primary-action`
  default to `13px`; `.btn-secondary`, `.secondary-action` and `.btn-ghost`
  default to `11px`. Both rules sit at `(0,0,1)` specificity on purpose, so a
  `text-sm` / `text-base` utility on an individual button now wins. Step a
  single button with a utility or by setting `--btn-font-size` on it.

---

## Shape and layout

- Corners stay square. No rounded cards, no pills. `input`, `select` and
  `textarea` are explicitly reset to `border-radius: 0`.
- Angularity comes from `clip-path` fold corners (`.fold-surface`,
  `.corner-cut`, `.btn-primary`), not from radii.
- Default border is 1px.
- `--aha-tap-min: 44px` is the minimum interactive target, applied as
  `min-height` on every button class.
- `html` reserves a stable scrollbar gutter, so opening a drawer or modal does
  not shift the page sideways.

---

## Motion

| Token | Value |
|---|---|
| `--aha-motion-fast` | `140ms` |
| `--aha-motion-base` | `260ms` |
| `--aha-motion-slow` | `640ms` |
| `--aha-motion-exit` | `150ms` |
| `--aha-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--aha-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |

- Transform and opacity only. Nothing animates layout.
- **Exits are faster than entrances.** Overlays arrive over 220–360ms and leave
  over 150ms, on the accelerating curve.
- Every overlay has a matching enter/exit class pair:
  `cart-backdrop-*`, `cart-panel-*`, `cart-dialog-*`, `mobile-menu-*`.
  Entrances only run when motion is allowed. **Exits are defined
  unconditionally** — a component that unmounts on `animationend` would
  otherwise hang forever under `prefers-reduced-motion: reduce` and leave an
  overlay sitting on top of checkout. Always pair the listener with a ~300ms
  `setTimeout` fallback.
- `prefers-reduced-motion: reduce` zeroes all four duration tokens and clamps
  every animation and transition to `0.001ms`.
- Scroll-driven reveals use native `animation-timeline: view()` behind
  `@supports`. Content is fully visible when timelines are unsupported.
- Never globally smooth-scroll commerce pages.

---

## Actions and states

- `.btn-primary` / `.primary-action` — rose fill, ink label, clipped corner,
  1px lift on hover (hover-capable devices, motion allowed), 0.98 scale on press.
- `.btn-secondary` / `.secondary-action` — transparent, `--aha-control-border`
  edge, accent border and label on hover.
- `.btn-ghost` — label only. **Currently zero consumers.**
- Disabled reduces contrast and keeps the label; `cursor: not-allowed`.
- Focus is a 3px `--aha-accent` outline at 3px offset, `:focus-visible` only.
  Form controls restore it with `!important` because several field classes use
  Tailwind's `focus:outline-none`.
- Under `forced-colors: active`, button `clip-path` is dropped and borders
  become `ButtonText` so Windows High Contrast users still see a control.

---

## Changing a token

1. Edit the primitive in `app/globals.css` `:root`.
2. If Tailwind consumes it, update the matching `--c-*` triplet — the two layers
   disagreeing is how `--aha-success` came to hold a 1.5:1 value for a year
   while `--c-success` held the corrected one.
3. Check contrast against `#FAFAFA` **and** `#F1F1F1`. Both grounds ship.
4. Update this file in the same commit.
