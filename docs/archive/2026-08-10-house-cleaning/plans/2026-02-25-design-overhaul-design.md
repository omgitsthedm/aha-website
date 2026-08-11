# AHA Website Design Overhaul

**Date:** 2026-02-25
**Approach:** "The Magazine" — Dark Editorial
**Status:** Approved

## Problem

The current site uses a dark/gold aesthetic with Syne typography, letter-by-letter animations, and ambient glow effects. It doesn't align with the actual AHA brand identity (black sheep mascot, lifestyle photography, NYC streetwear positioning) and feels generic rather than premium.

## Design Direction

Dark editorial magazine feel. Sections alternate between warm charcoal and near-black, creating rhythm without leaving the after-hours mood. The black sheep mascot is the primary visual anchor. Photography-heavy. Typography-forward hero. No gradients, no neon, no gimmicks.

Reference brands: Kith, Noah NY, Stussy.

## Color System

| Role | Value |
|------|-------|
| Light section bg | `#1C1A18` warm charcoal |
| Dark section bg | `#0A0A0A` near-black |
| Primary text | `#EDE9E3` warm off-white |
| Accent (gold, muted) | `#C8A961` |
| Muted text | `#7A756E` |
| Surface (light) | `#252320` |
| Surface (dark) | `#151413` |
| Border (light) | `#3A3632` |
| Border (dark) | `#222020` |
| CTA buttons | Off-white `#EDE9E3` on transparent border or solid fill |

No white backgrounds. No bright gold. No neon. Everything stays nocturnal.

## Typography

| Role | Font |
|------|------|
| Display/Headlines | Neue Haas Grotesk or Helvetica Neue — clean, NYC, authoritative |
| Body | Inter — modern, readable |
| Data/Mono | IBM Plex Mono (keep) or JetBrains Mono |
| Brand accent (editorial) | Dropped — the sheep mascot IS the accent |

## Brand Marks

- **Primary mark:** Full black sheep silhouette — flat, minimal, graphic
- **Micro mark:** Sheep head outline — section dividers, favicon, bullet icons
- **Script logo:** "After Hours" hand-drawn script with "A G E N D A" in spaced caps — used in nav/footer

## Homepage Layout

### 1. Announcement Bar
- Single line on `#0A0A0A`
- Rotating: "Tracked Shipping | Easy Exchanges | Secure Checkout"
- Mono type, no icons

### 2. Navigation
- Sticky, transparent on hero, solid on scroll
- Left: sheep head micro mark
- Center: "AFTER HOURS AGENDA" in spaced caps or script logo
- Right: Shop, Cart
- No hamburger on desktop

### 3. Hero (warm charcoal `#1C1A18`)
- **Typography-forward split layout**
- Left 60%: Large sheep silhouette, editorial crop (bleeds off bottom)
- Right 40%: "BUILT FOR THE ONES STILL MOVING AFTER HOURS" in bold type
- CTA: "SHOP THE DROP" bordered button
- Animation: Simple fade-in. No parallax, no letter-by-letter.

### 4. Featured Drop (dark `#0A0A0A`)
- Label: "FEATURED" in tracked mono
- 4 product cards, clean grid
- Subtle opacity hover, no overlays

### 5. Trust Strip (warm charcoal `#1C1A18`)
- 3 blocks: Tracked Shipping / Easy Exchanges / Secure Checkout
- Sheep head as bullet icon
- One line each, mono type

### 6. Best Sellers (dark `#0A0A0A`)
- Label: "MOST WANTED" in tracked mono
- 4 product cards
- "Shop All" link

### 7. Editorial Gallery (warm charcoal `#1C1A18`)
- Asymmetric masonry grid: 4-6 strongest lifestyle photos
- No text overlays, just photography
- Brand world moment

### 8. Brand Story (dark `#0A0A0A`)
- Large display headline: "Black Sheep Mentality" or "Uniform for the Relentless"
- 2-3 lines brand copy
- Sheep silhouette divider

### 9. Email Signup (warm charcoal `#1C1A18`)
- "YOUR NAME ON THE LIST?"
- Simple email input + button

### 10. Footer (darkest `#0A0A0A`)
- Link columns: Shop, About, Support
- Social links
- Subtle sheep silhouette
- Copyright

## Product Pages

- Split layout: image gallery left, details right
- Dark bg for product hero
- Warm charcoal for related products
- Sheep micro-mark as trust badge icons
- Size selector: bordered buttons, off-white selected state
- Add to Cart: solid off-white button, brief gold flash on add

## Shop Page

- Dark bg, clean filter tabs (All, Hoodies, Tees, Accessories)
- 3-col desktop, 2-col mobile grid
- Product cards: image fills card, name + price below
- No hover overlays, subtle scale

## Navigation

- Cart drawer: slide from right, restyled to match
- Mobile: full-screen overlay, large stacked links, sheep at bottom

## Files Changed (Expected)

- `tailwind.config.js` — full color/font/animation replacement
- `app/globals.css` — new base styles
- `app/layout.tsx` — new font imports
- `components/homepage/*` — all homepage sections rewritten
- `components/layout/NavBar.tsx` — new nav design
- `components/layout/Footer.tsx` — new footer
- `components/product/ProductDetail.tsx` — reskinned
- `components/shop/ShopContent.tsx` — reskinned
- `public/` — sheep SVGs, optimized lifestyle photos
