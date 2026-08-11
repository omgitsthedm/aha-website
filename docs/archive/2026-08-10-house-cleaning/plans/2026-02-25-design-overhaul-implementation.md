# AHA Dark Editorial Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current generic dark/gold aesthetic with a dark editorial magazine design centered on the black sheep mascot, warm charcoal/near-black alternation, and Inter/Helvetica typography.

**Architecture:** Pure visual reskin of an existing Next.js 14 App Router site. No API changes, no route changes, no business logic changes. All work is in Tailwind config, CSS, and component JSX/styling. The site uses Square API for products and Printful for fulfillment — those integrations remain untouched.

**Tech Stack:** Next.js 14, Tailwind CSS 3, TypeScript, next/font (Google Fonts)

**Design doc:** `docs/plans/2026-02-25-design-overhaul-design.md`

---

## Task 1: Create SVG Brand Assets

**Files:**
- Create: `public/brand/sheep-full.svg` (full-body sheep silhouette)
- Create: `public/brand/sheep-head.svg` (sheep head micro mark)
- Create: `public/brand/sheep-pattern.svg` (optional, subtle repeat pattern)

**Step 1: Create the full-body sheep SVG**

Create `public/brand/sheep-full.svg` — a flat black silhouette of the sheep from the Printful products. Trace the shape: rounded body, four legs, small tail, head with a single eye notch. Keep it under 2KB. All black fill, no stroke.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" fill="currentColor">
  <!-- Simplified black sheep silhouette matching the brand product imagery -->
  <!-- Body: rounded cloud-like shape -->
  <!-- Head: attached left, slight forward tilt -->
  <!-- Legs: four straight rectangles -->
  <!-- Eye: single negative-space oval -->
</svg>
```

Reference image: `public/printful-assets/Black_Sheep_-_Bone_Unisex_Premium_Sweatshirt.png`

**Step 2: Create the sheep head micro mark SVG**

Create `public/brand/sheep-head.svg` — just the head outline (the "Sheep Min" mark from the hoodies). Single stroke, no fill.

Reference image: `public/printful-assets/Sheep_Min_-_Black_Unisex_Hoodie.png`

**Step 3: Verify assets load**

Run: `npm run build`
Expected: Build succeeds. SVGs are in `/brand/` route.

**Step 4: Commit**

```bash
git add public/brand/
git commit -m "feat: add black sheep SVG brand assets"
```

---

## Task 2: Foundation — Tailwind Config & Color System

**Files:**
- Modify: `tailwind.config.js`

**Step 1: Replace the entire color palette and font families**

Replace the full `tailwind.config.js` with the new dark editorial design system:

Colors:
- `void`: `#0A0A0A` (was `#080808`)
- `charcoal`: `#1C1A18` (new — warm charcoal for "light" sections)
- `surface`: `{ DEFAULT: '#151413', warm: '#252320' }` (was `#111111`)
- `elevated`: `#2A2826` (was `#1C1C1C`)
- `border`: `{ DEFAULT: '#222020', warm: '#3A3632' }` (was `#2A2A2A`)
- `gold`: `{ DEFAULT: '#C8A961', dim: 'rgba(200,169,97,0.25)', faint: 'rgba(200,169,97,0.08)' }` (was glow `#D4A853`)
- `cream`: `#EDE9E3` (was `#E8E4DD`)
- `muted`: `#7A756E` (was `#6B6560`)
- `danger`: `#EA4A4A` (keep)
- `success`: `#4AEA80` (keep)

Font families:
- `display`: `var(--font-inter)` with weight 700-900 (replaces Syne)
- `body`: `var(--font-inter)` (replaces DM Sans)
- `mono`: `var(--font-ibm-plex)` (keep)
- Remove `editorial` (was Instrument Serif)

Font sizes:
- Keep `hero`, `chapter`, `section`, `label` — these are well-calibrated

Animations:
- Keep `fade-up`, `fade-in`, `grain`, `slide-in-right`
- Keep `breathe` (used for scroll indicator)
- Remove `text-reveal` (not used in new design)

**Step 2: Build to verify config**

Run: `npm run build`
Expected: Build succeeds. Warnings about unused classes are OK — we'll clean those up as we rewrite components.

**Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: replace color palette and typography for dark editorial design"
```

---

## Task 3: Foundation — Global CSS & Font Imports

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Step 1: Update layout.tsx font imports**

Replace Syne, DM_Sans, Instrument_Serif with Inter. Keep IBM_Plex_Mono.

```tsx
import { Inter, IBM_Plex_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex",
  display: "swap",
  weight: ["400", "500"],
});
```

Update html `className` to use `${inter.variable} ${ibmPlexMono.variable}`.
Update body to use `bg-void text-cream font-body`.

**Step 2: Update globals.css**

- Change `html` and `body` background to `#0A0A0A`, text to `#EDE9E3`
- Update `::selection` to use gold `rgba(200,169,97,0.3)`
- Update scrollbar colors to match new border colors
- Remove `.film-grain` or reduce opacity further (optional — keep very subtle)
- Keep `.reveal` and `.stagger-children` utility classes
- Update `body` font-family to `var(--font-inter)`

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. The site now has Inter as the base font and the new color foundation.

**Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: switch to Inter font, update global styles for dark editorial"
```

---

## Task 4: Navigation — NavBar Redesign

**Files:**
- Modify: `components/ui/NavBar.tsx`

**Step 1: Rewrite NavBar with sheep micro mark and new styling**

Key changes:
- Add sheep head SVG inline as the left logo mark (small, ~24px)
- Center text: "AFTER HOURS AGENDA" in font-mono, spaced, uppercase tracking-[0.3em], text-sm
- Right: Shop link (desktop only), Cart icon
- Scrolled state: `bg-void/95 backdrop-blur-md border-b border-border`
- Replace all `text-glow` with `text-gold`
- Replace all `hover:text-glow` with `hover:text-cream`
- Mobile menu: full-screen `bg-void/98`, large stacked links, sheep silhouette at bottom center (small, subtle)
- Cart badge: `bg-gold text-void` (was `bg-glow text-void`)
- Height: keep h-16

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/ui/NavBar.tsx
git commit -m "feat: redesign navbar with sheep mark and editorial styling"
```

---

## Task 5: Hero Section — Typography-Forward Split

**Files:**
- Modify: `components/homepage/Entrance.tsx` (rewrite entirely)

**Step 1: Rewrite Entrance.tsx as the editorial split hero**

Replace the letter-by-letter animation with a clean split layout:

- Outer: `section` with `bg-charcoal` (warm charcoal), full viewport height minus nav
- Left 55-60%: Large sheep silhouette SVG (use `next/image` pointing to `/brand/sheep-full.svg`), positioned to bleed off the bottom edge, opacity ~0.9 on dark bg or use the SVG in `currentColor` with a slightly brighter shade
- Right 40-45%:
  - Headline: "BUILT FOR THE ONES STILL MOVING AFTER HOURS" — `font-display font-black text-3xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight`
  - Subtitle: "Black Sheep Mentality" — `font-mono text-sm text-muted tracking-[0.15em] uppercase mt-6`
  - CTA: "SHOP THE DROP" — bordered button, `border border-cream text-cream px-8 py-3 font-mono text-sm tracking-wide hover:bg-cream hover:text-void transition-all mt-8 inline-block`
- Animation: simple `opacity-0 → opacity-100` fade-in with 0.6s delay on text side. Use Tailwind animate-fade-in with a style delay. No letter-by-letter.
- Mobile: stack vertically — sheep on top (smaller), text below

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/homepage/Entrance.tsx
git commit -m "feat: replace letter animation with editorial split hero"
```

---

## Task 6: Announcement Bar — New Component

**Files:**
- Create: `components/ui/AnnouncementBar.tsx`
- Modify: `app/layout.tsx` (add above NavBar)

**Step 1: Create AnnouncementBar component**

Simple rotating text bar:
- Background: `bg-void` (darkest)
- Text: `font-mono text-[11px] text-muted tracking-[0.1em] text-center py-2`
- Rotating messages: "FREE SHIPPING ON ORDERS $75+" → "TRACKED SHIPPING ON ALL ORDERS" → "30-DAY EASY RETURNS"
- Use `useState` + `setInterval` (5s) to cycle messages with a fade transition
- No close button, no icons

**Step 2: Add to layout.tsx above NavBar**

Import and render `<AnnouncementBar />` above `<NavBar />` in the body.

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Announcement bar renders above nav.

**Step 4: Commit**

```bash
git add components/ui/AnnouncementBar.tsx app/layout.tsx
git commit -m "feat: add announcement bar with rotating messages"
```

---

## Task 7: Homepage — Featured Drop & Most Wanted (Product Grids)

**Files:**
- Modify: `components/homepage/LatestDrop.tsx` (rename concept to "Featured")
- Modify: `components/homepage/MostWanted.tsx`

**Step 1: Reskin LatestDrop as Featured section**

- Outer section: `bg-void` (dark section)
- Replace "Latest Drop" label with "FEATURED" — `font-mono text-[11px] text-muted tracking-[0.2em] uppercase`
- Replace "Fresh off the press" heading with "New This Week" or similar — `font-display font-bold text-2xl md:text-3xl text-cream`
- Product cards: keep the editorial layout (hero + stacked right), but update colors:
  - Card bg: `bg-surface` (was same)
  - Name hover: `group-hover:text-gold` (was `group-hover:text-glow`)
  - Price: `text-muted` (keep)
  - Border on stacked cards: `border-border hover:border-warm` (warm border on hover)

**Step 2: Reskin MostWanted**

- Outer section: `bg-void` (dark section — will sit next to charcoal sections)
- Same color updates as LatestDrop
- Replace `hover:text-glow` with `hover:text-gold`
- Keep the grid layout (large first card + smaller grid)

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add components/homepage/LatestDrop.tsx components/homepage/MostWanted.tsx
git commit -m "feat: reskin product grids with dark editorial palette"
```

---

## Task 8: Homepage — Trust Strip (Reskin ThePromise)

**Files:**
- Modify: `components/homepage/ThePromise.tsx`

**Step 1: Reskin as trust strip on warm charcoal**

- Outer section: `bg-charcoal` (warm charcoal — "light" section)
- Replace SVG icons with sheep head micro mark for each trust point (or keep SVG icons but style them in `text-gold` instead of `text-muted`)
- Text: keep mono type, update colors to match new palette
- Consider reducing to 3 items (Tracked Shipping / Easy Exchanges / Secure Checkout) per design doc
- Border between items: optional thin gold line or just spacing

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/homepage/ThePromise.tsx
git commit -m "feat: reskin trust strip with charcoal background"
```

---

## Task 9: Homepage — Editorial Gallery (New Component)

**Files:**
- Create: `components/homepage/EditorialGallery.tsx`
- Modify: `app/page.tsx` (add to homepage)

**Step 1: Create EditorialGallery component**

Asymmetric masonry grid showing 4-6 lifestyle photos:
- Outer section: `bg-charcoal` (warm charcoal)
- No section heading — just the photos
- Grid: CSS grid with varying column spans
  - Row 1: one large (col-span-2), one small (col-span-1)
  - Row 2: one small, one large
  - Mobile: single column
- Images sourced from `/brand/lifestyle/` (we'll copy the best photos there)
- Use `next/image` with priority on first image
- No hover effects, no overlays — just the photography

**Step 2: Copy 4-6 best lifestyle photos to public/brand/lifestyle/**

From `/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Marketing/Photos/`:
- Pick 4-6 strongest photos
- Resize to ~1200px wide max
- Copy to `public/brand/lifestyle/`

**Step 3: Add to homepage in page.tsx**

Insert `<EditorialGallery />` between MostWanted/BestSellers and the brand story section.

**Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add components/homepage/EditorialGallery.tsx app/page.tsx public/brand/lifestyle/
git commit -m "feat: add editorial lifestyle gallery section"
```

---

## Task 10: Homepage — Brand Story (Replace Agenda)

**Files:**
- Modify: `components/homepage/Agenda.tsx` (rewrite entirely)

**Step 1: Rewrite Agenda as Brand Story section**

Replace the scroll-revealing manifesto lines with a focused brand story block:
- Outer section: `bg-void` (dark section)
- Center-aligned content, max-w-3xl
- Small sheep silhouette SVG centered, `w-16 h-16 opacity-30 mb-8`
- Headline: "UNIFORM FOR THE RELENTLESS" — `font-display font-black text-2xl md:text-4xl text-cream text-center tracking-tight`
- Body: 2-3 lines of brand copy — `font-body text-sm md:text-base text-muted text-center leading-relaxed mt-6 max-w-lg mx-auto`
- Copy: "Born in New York. Built after hours. For the ones who refuse to follow the flock. Every piece carries the black sheep mark — because standing apart is the only agenda worth keeping."
- Simple fade-in on scroll using ScrollReveal

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/homepage/Agenda.tsx
git commit -m "feat: replace manifesto with brand story block"
```

---

## Task 11: Homepage — Collections Grid

**Files:**
- Modify: `components/homepage/Collections.tsx`

**Step 1: Reskin collections with warm charcoal bg**

- Outer section: `bg-charcoal` (warm charcoal section)
- Keep the gap-px grid layout — it's clean
- Update card colors:
  - Default bg: `bg-charcoal` → hover: `bg-surface-warm`
  - Text: `text-cream`
  - Hover text: stays `text-cream` (was same)
  - "Explore →" mono: `text-muted group-hover:text-gold`
- Section heading: update to new palette colors
- Replace `bg-border` grid gap to `bg-border-warm`

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/homepage/Collections.tsx
git commit -m "feat: reskin collections grid with warm charcoal palette"
```

---

## Task 12: Homepage — Email Signup

**Files:**
- Modify: `components/homepage/GetOnTheList.tsx`

**Step 1: Reskin email signup on warm charcoal**

- Outer section: `bg-charcoal`
- Heading: "YOUR NAME ON THE LIST?" — `font-display font-bold text-2xl md:text-3xl text-cream`
- Subtext: update colors to `text-muted`
- Input: `bg-surface border-border` focus: `border-gold/50 ring-gold/20`
- Button: `bg-cream text-void hover:bg-cream/80` (keep current solid button style)
- Success state: `text-gold` (was `text-glow`)

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/homepage/GetOnTheList.tsx
git commit -m "feat: reskin email signup with editorial palette"
```

---

## Task 13: Homepage — Page Assembly

**Files:**
- Modify: `app/page.tsx`

**Step 1: Update homepage section order**

New order matching design doc:
1. `<Entrance />` (hero — already handled in Task 5)
2. `<LatestDrop />` (featured drop — dark section)
3. `<ThePromise />` (trust strip — charcoal section)
4. `<MostWanted />` (best sellers — dark section)
5. `<EditorialGallery />` (lifestyle photos — charcoal section)
6. `<Agenda />` (brand story — dark section)
7. `<Collections />` (collections grid — charcoal section)
8. `<GetOnTheList />` (email signup — charcoal section)

Note: Announcement bar is in layout.tsx (Task 6), not page.tsx.

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds with all sections in new order.

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: reorder homepage sections for editorial flow"
```

---

## Task 14: Footer Redesign

**Files:**
- Modify: `components/ui/Footer.tsx`

**Step 1: Reskin footer**

- Background: `bg-void border-t border-border`
- Replace `hover:text-glow` with `hover:text-gold` on all links
- Replace `font-display` brand name with `font-mono text-sm tracking-[0.3em] uppercase`
- Add subtle sheep silhouette at the bottom center: `opacity-10 w-24`
- Keep link structure (collections, info, legal columns)
- Update all colors to new palette

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/ui/Footer.tsx
git commit -m "feat: reskin footer with editorial palette and sheep mark"
```

---

## Task 15: Product Detail Page Reskin

**Files:**
- Modify: `components/product/ProductDetail.tsx`

**Step 1: Reskin product detail with new palette**

Key changes:
- Background sections: keep dark, use new color values
- Replace `text-glow` with `text-gold` throughout
- Replace `hover:text-glow` with `hover:text-gold`
- Size selector selected state: `border-cream bg-cream text-void` (keep, it matches)
- Add to Cart button: `bg-cream text-void hover:bg-cream/80` (keep)
- Added feedback state: `bg-gold text-void` (was `bg-glow text-void`)
- Trust badges: update text to use new `text-muted` value
- Breadcrumb: update `hover:text-cream` (keep), `text-muted` (keep)
- Related products: `hover:text-gold` on names

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/product/ProductDetail.tsx
git commit -m "feat: reskin product detail with editorial palette"
```

---

## Task 16: Shop Page Reskin

**Files:**
- Modify: `components/shop/ShopContent.tsx`

**Step 1: Reskin shop grid with new palette**

Key changes:
- Background: `bg-void`
- Filter buttons: `border-border text-muted` → active: `border-cream text-cream`
- Product cards: `bg-surface` cards, `hover:text-gold` on names
- Select dropdowns: update border and focus colors
- Replace all `text-glow` / `hover:text-glow` with `text-gold` / `hover:text-gold`

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/shop/ShopContent.tsx
git commit -m "feat: reskin shop grid with editorial palette"
```

---

## Task 17: Cart Drawer Reskin

**Files:**
- Modify: `components/cart/CartDrawer.tsx`

**Step 1: Reskin cart drawer**

Key changes:
- Drawer bg: `bg-surface` → update to `bg-void` or `bg-surface` (new value)
- Replace `text-glow` with `text-gold`
- Checkout button: `bg-cream text-void hover:bg-gold` (was `hover:bg-glow`)
- Replace emoji trust badges (🔒📦↩️) with text-only: "SECURE | FREE SHIP $75+ | 30-DAY RETURNS"
- Quantity buttons: `border-border hover:border-cream`
- "CONTINUE SHOPPING →" link: `text-gold hover:text-cream`

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/cart/CartDrawer.tsx
git commit -m "feat: reskin cart drawer, remove emoji trust badges"
```

---

## Task 18: Final Build, Verify & Deploy

**Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds with 15+ pages, no errors.

**Step 2: Visual check** (if dev server available)

Run: `npm run dev`
Verify:
- Homepage sections alternate charcoal ↔ dark
- Hero shows sheep silhouette + editorial text
- Announcement bar visible at top
- Nav has sheep micro mark
- Product grids use new color palette
- No remaining gold (#D4A853) references
- No remaining glow references (search codebase)

**Step 3: Grep for old design system remnants**

Run: `grep -r "text-glow\|bg-glow\|border-glow\|#D4A853\|font-editorial\|font-instrument\|font-syne\|--font-syne\|--font-dm-sans\|--font-instrument" --include="*.tsx" --include="*.ts" --include="*.css" --include="*.js" .`

Expected: No matches (all old references should be replaced).

**Step 4: Push and deploy**

```bash
git push origin main
```

Netlify auto-deploys from main. Verify at https://afterhoursagenda.netlify.app

**Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup after design overhaul"
git push origin main
```
