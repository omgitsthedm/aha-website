# After Hours Agenda Design Tokens

Effective: 2026-07-10. This file replaces the former blacklight, neon, zine, and subway token model.

The source of truth is `app/globals.css`, mirrored by semantic names in `tailwind.config.js`. Components must not introduce raw color values.

## Color

| Role | CSS primitive | Tailwind | Value | Use |
|---|---|---|---|---|
| Page ink | `--aha-ink` | `void` | `#0f0f0e` | page and drawer background |
| Soft ink | `--aha-ink-soft` | `charcoal` | `#171716` | section distinction |
| Surface | `--aha-surface` | `surface` | `#20201e` | quiet grouped content |
| Paper | `--aha-paper` | `cream` / `border` | `#f0ebe3` | primary text and high-contrast marks |
| Muted paper | `--aha-paper-muted` | `muted` | `#b9b2a8` | supporting text |
| Rule | `--aha-line` | `border` with opacity | `#4b4944` | separators and controls |
| AHA pink | `--aha-accent` | `accent` | `#ff5a8a` | primary action, focus, selected state |
| Success | `--aha-success` | `success` | `#77c991` | confirmed success only |
| Warning | `--aha-warning` | `warning` | `#e9b85a` | recoverable attention state |
| Error | `--aha-error` | `danger` | `#ff6b6b` | blocking failure only |

Only AHA pink is a brand accent. Success, warning, and error are functional states, never decorative alternatives.

## Type

- Display: Arial Black with Helvetica/Arial system fallback.
- Body, labels, controls, prices, and data: IBM Plex Mono in weights 400, 500, 600, and 700.
- Maximum of two type families on any route.
- Use the display face for hierarchy, not paragraphs or controls.

## Shape and layout

- Corners remain square. Do not introduce rounded cards or pill-shaped controls.
- Default border is 1px. A 2px AHA pink rule may mark a page or section start.
- Group content with spacing, rules, and shared alignment before adding containers.
- Product media uses native image ratio and a single quiet border.
- Minimum interactive target is 44 by 44 CSS pixels.

## Motion

- Default duration is 120ms for action feedback.
- Product image hover may use a restrained 1.02 scale over 300ms.
- Dialogs and drawers do not require decorative entrance animation.
- `prefers-reduced-motion` removes nonessential animation and smooth scrolling.

## Actions and states

- `.primary-action` is the only solid AHA pink action treatment.
- Secondary actions use transparent background and a quiet border or underlined text.
- Disabled state reduces contrast and preserves the label.
- Selected filters and sizes use AHA pink plus `aria-pressed`.
- Status is always conveyed with text, not color alone.

## Prohibited legacy language

Do not add blacklight, neon, subway, metrocard, split-flap, zine-sticker, misprint, mosaic-border, tape, rotation, glow, particle canvas, or multicolor collection accents. Those visual systems were removed in the v3 overhaul.
