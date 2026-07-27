# After Hours Agenda Design System

Status: controlling visual system  
Adopted: July 12, 2026  
Source brief: `/Users/davidmarsh/Downloads/design-2.md` (`Origami Geométrico`, alpha)

This document adapts the supplied Origami Geométrico direction to a production DTC storefront. It controls every customer-facing page, commerce surface, state, and transactional email unless a platform requirement—such as Square wallet branding—must remain standard.

## Principles

- Folded, angular, precise, and contemporary.
- Geometry communicates structure; it is not decorative noise.
- Square corners only. No pills, glass cards, soft SaaS panels, or generic three-feature layouts.
- Commerce clarity, accessibility, and performance override visual novelty.
- Only transform and opacity animate. Motion remains subtle and respects reduced-motion preferences.

## Color tokens

| Role | Value | Ships as |
|---|---|---|
| Paper White | `#FAFAFA` | ground |
| Sunken Paper | `#F1F1F1` | tinted panels |
| Ink Black | `#1A1A1A` | primary text |
| Steel Grey | `#4A4A4A` | supporting text |
| Fold Shadow | `#B0B0B0` | decorative hairlines only |
| Control Border | `#8A8A8A` | the edge of an interactive control |
| Accent Coral | `#FF6B6B` | rose **fill**, ink label on top |
| Action Rose | `#CE3D56` | rose **text** and focus, on paper |
| Action Rose (sunken) | `#B8304A` | rose text on `#F1F1F1` or darker |
| Sky Fold | `#87CEEB` | fold plane |
| Sage Paper | `#A8D5BA` | fold plane |
| Warm Crease | `#F0C987` | fold plane |

Paper White is the storefront ground. Ink Black is primary text. Sky, sage, and warm crease are supporting paper-fold planes, never competing CTAs and never status colors — sage and warm crease previously served as success and warning and measured ~1.5:1 on paper. Large black refracted backgrounds are not part of the storefront system.

The rose is two values, and using the wrong one is the most common way to fail an audit here. **Accent Coral `#FF6B6B` is a surface, never a text color** — 2.5:1 on paper. Rose type, links, labels and focus rings use Action Rose `#CE3D56` (4.55:1), and drop to `#B8304A` on any tinted ground, because `#CE3D56` falls to 4.20:1 on `#F1F1F1`. Where a control's border is its only visual identification, that border is Control Border `#8A8A8A` (3.31:1) rather than Fold Shadow, which WCAG 1.4.11 only exempts for decoration.

Exact values, Tailwind names and the change procedure live in `docs/design-tokens.md`.

## Type

- Display and body: Poppins. Metadata and technical values: JetBrains Mono.
- **Only weights 400 and 700 are loaded.** Anything between them is a synthesised face, not a downloaded one.
- Sizes come from the named scale in `docs/design-tokens.md` — `display-hero`, `display-section`, `display-sub`, body, `label`, `eyebrow` — not from fresh `clamp()` expressions.
- Body: 1rem / 1.6 with a maximum readable width of 72 characters.
- Form controls never render below 16px; iOS zooms the viewport if they do.

## Layout

- CSS Grid first.
- Content width: 1280px with 1.5rem desktop gutters and 1rem mobile gutters.
- Base spacing unit: 8px.
- Multi-column layouts collapse below 768px.
- Product and content sections use asymmetric or zig-zag composition; equal feature-card rows are prohibited.
- Z-index contract: base 0, sticky navigation 100, overlay 200, modal 300, toast/skip link 500.

## Surfaces and components

- `fold-surface`: faceted panel with a clipped upper corner, crease planes, one-pixel stroke, and restrained depth.
- `crease-rule`: section/header line with a quiet diagonal fold pattern.
- Primary action: coral fill, sharp clipped corner, 200–300ms lift on hover, 1px tactile press.
- Secondary action: sharp outlined control with a light background response.
- Inputs: label above, square border, coral 2–3px focus indicator, error text below.
- Skeletons mirror final geometry; never use circular spinners.
- Empty and error states include an explanation and a recovery action.

## Motion

- Default entry: opacity plus 16px translate-Y over 420ms ease-out.
- Stagger lists by 80ms.
- Hover: 200ms color/shadow adjustment.
- Page transition: opacity only, 200ms.
- **Every overlay that animates in animates out, and leaves faster than it arrived** — roughly 150ms out against 220–360ms in, on an accelerating curve. A drawer that slid in from the right leaves to the right; it does not blink out. Exit classes are defined outside the reduced-motion guard so an `animationend` unmount cannot hang, and are always paired with a timeout fallback: a stuck overlay blocks checkout.
- Never globally smooth-scroll commerce pages; it can interfere with touch targeting.

## Content and accessibility

- No emoji, fake urgency, scarcity, fabricated reviews, or AI-writing clichés.
- Controls remain at least 44px.
- WCAG 2.2 AA contrast and visible focus are mandatory.
- Product selection, bag, checkout, support, order tracking, email, loading, empty, error, and success states use the same system.
