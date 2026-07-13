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

| Role | Value |
|---|---|
| Paper White | `#FAFAFA` |
| Fold Shadow | `#B0B0B0` |
| Ink Black | `#1A1A1A` |
| Accent Coral | `#FF6B6B` |
| Sky Fold | `#87CEEB` |
| Sage Paper | `#A8D5BA` |
| Warm Crease | `#F0C987` |
| Steel Grey | `#4A4A4A` |

Ink Black is the storefront ground. Paper White is primary text. Coral owns actions and focus. Sky, sage, and warm crease are supporting fold planes, never competing CTAs.

## Type

- Display and body: Poppins, weights 400–700.
- Metadata and technical values: JetBrains Mono, weights 400–700.
- Hero: `clamp(2.5rem, 5vw, 4rem)` as the default ceiling; larger type is reserved for the name on the homepage.
- Body: 1rem / 1.6 with a maximum readable width of 72 characters.
- UI labels: 0.875rem, weight 500, slight tracking.

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
- Never globally smooth-scroll commerce pages; it can interfere with touch targeting.

## Content and accessibility

- No emoji, fake urgency, scarcity, fabricated reviews, or AI-writing clichés.
- Controls remain at least 44px.
- WCAG 2.2 AA contrast and visible focus are mandatory.
- Product selection, bag, checkout, support, order tracking, email, loading, empty, error, and success states use the same system.
