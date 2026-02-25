# The Platform — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform AHA from a dark editorial magazine design to a NYC subway station experience — merging order.design's asymmetric layout with the MTA NYCTA signage system.

**Architecture:** Pure visual reskin (no API or business logic changes). Replace the Tailwind color palette with MTA-authentic colors, add a collection-to-subway-line color mapping system, rebuild components with order.design's asymmetric layout patterns and MTA signage elements (white band dividers, route badges, monospace-forward typography).

**Tech Stack:** Next.js 14, Tailwind CSS 3, TypeScript, Inter + IBM Plex Mono fonts

**Design Doc:** `docs/plans/2026-02-25-the-platform-design.md`

---

### Task 1: Color Palette — MTA Subway Colors

Replace the entire Tailwind color palette with MTA-authentic values and add the subway line color system.

**Files:**
- Modify: `tailwind.config.js`

**Changes:**

Replace the `colors` object with:

```javascript
colors: {
  // Core — subway tunnel darkness
  void: "#141414",
  charcoal: "#1C1A18",
  surface: {
    DEFAULT: "#1A1918",
    warm: "#252320",
  },
  elevated: "#2A2826",
  border: {
    DEFAULT: "#2A2725",
    warm: "#3A3632",
  },
  // Text — aged porcelain (not pure white)
  cream: "#E8E4DE",
  muted: "#7A756E",
  // MTA Subway Line Colors
  line: {
    red: "#EE352E",       // 1/2/3 — Black Sheep
    blue: "#2850AD",      // A/C/E — No Kings
    orange: "#FF6319",    // B/D/F/M — Night Mode
    green: "#00933C",     // 4/5/6 — NYC Forever
    yellow: "#FCCC0A",    // N/Q/R/W — New Arrivals
    purple: "#B933AD",    // 7 — reserved
    brown: "#996633",     // J/Z — reserved
    gray: "#A7A9AC",      // L — reserved
  },
  // Utility
  danger: "#EE352E",
  success: "#00933C",
  // Legacy alias (prevents breaking refs during migration)
  gold: {
    DEFAULT: "#C8A961",
    dim: "rgba(200,169,97,0.25)",
    faint: "rgba(200,169,97,0.08)",
  },
}
```

Remove the `grain` animation (we'll drop the film grain overlay). Keep `fade-up`, `fade-in`, `slide-in-right`, `breathe`.

**Commit:** `feat: replace color palette with MTA subway line system`

---

### Task 2: Global Styles — Tunnel Darkness + White Band

Update globals.css to reflect the new palette and add the white band utility class.

**Files:**
- Modify: `app/globals.css`

**Changes:**

1. Update base HTML background: `#0A0A0A` → `#141414`
2. Update body text: `#EDE9E3` → `#E8E4DE`
3. Update selection color: `rgba(200,169,97,0.3)` → `rgba(232,228,222,0.2)`
4. Update scrollbar: thumb `#222020` → `#2A2725`, hover `#3A3632` unchanged
5. Remove the `.film-grain` class entirely (no grain overlay in subway aesthetic)
6. Keep `.reveal` and `.stagger-children` intact
7. Add a `.white-band` utility class:

```css
.white-band {
  border-bottom: 1px solid rgba(232, 228, 222, 0.15);
}
.white-band-strong {
  border-bottom: 1px solid #E8E4DE;
}
```

**Commit:** `feat: update globals for subway tunnel aesthetic, add white band`

---

### Task 3: Layout — Remove Film Grain, Keep Structure

Update layout.tsx to remove the FilmGrain component.

**Files:**
- Modify: `app/layout.tsx`

**Changes:**

1. Remove `import { FilmGrain } from "@/components/ui/FilmGrain";`
2. Remove `<FilmGrain />` from the body
3. Keep everything else: fonts, AnnouncementBar, NavBar, Footer, CartProvider

**Commit:** `feat: remove film grain overlay for clean subway aesthetic`

---

### Task 4: Collection Line Config — The Subway Map

Create a shared configuration that maps collections to subway line colors and badges.

**Files:**
- Create: `lib/utils/subway-lines.ts`

**Code:**

```typescript
export interface SubwayLine {
  slug: string;
  name: string;
  abbr: string;        // 2-letter badge code
  color: string;       // Hex color
  tailwind: string;    // Tailwind class name (bg-line-red, etc.)
  mtaLine: string;     // Actual MTA line reference
}

export const SUBWAY_LINES: Record<string, SubwayLine> = {
  "black-sheep": {
    slug: "black-sheep",
    name: "Black Sheep",
    abbr: "BS",
    color: "#EE352E",
    tailwind: "line-red",
    mtaLine: "1/2/3",
  },
  "no-kings": {
    slug: "no-kings",
    name: "No Kings",
    abbr: "NK",
    color: "#2850AD",
    tailwind: "line-blue",
    mtaLine: "A/C/E",
  },
  "night-mode": {
    slug: "night-mode",
    name: "Night Mode",
    abbr: "NM",
    color: "#FF6319",
    tailwind: "line-orange",
    mtaLine: "B/D/F/M",
  },
  "nyc-forever": {
    slug: "nyc-forever",
    name: "NYC Forever",
    abbr: "NY",
    color: "#00933C",
    tailwind: "line-green",
    mtaLine: "4/5/6",
  },
  "new-arrivals": {
    slug: "new-arrivals",
    name: "New Arrivals",
    abbr: "NA",
    color: "#FCCC0A",
    tailwind: "line-yellow",
    mtaLine: "N/Q/R/W",
  },
};

// Fallback for collections not in the map
export const DEFAULT_LINE: SubwayLine = {
  slug: "unknown",
  name: "All Lines",
  abbr: "AL",
  color: "#A7A9AC",
  tailwind: "line-gray",
  mtaLine: "S",
};

export function getLineForCollection(slug: string): SubwayLine {
  return SUBWAY_LINES[slug] || DEFAULT_LINE;
}

export function getLineForCollectionId(
  collectionId: string,
  collections: { id: string; slug: string }[]
): SubwayLine {
  const col = collections.find((c) => c.id === collectionId);
  if (!col) return DEFAULT_LINE;
  return getLineForCollection(col.slug);
}
```

**Commit:** `feat: add subway line configuration for collection mapping`

---

### Task 5: Route Badge Component

Create the reusable MTA-style route badge component.

**Files:**
- Create: `components/ui/RouteBadge.tsx`

**Code:**

```tsx
import { getLineForCollection, type SubwayLine, DEFAULT_LINE } from "@/lib/utils/subway-lines";

interface RouteBadgeProps {
  slug?: string;
  line?: SubwayLine;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizes = {
  sm: { circle: "w-5 h-5", text: "text-[9px]", name: "text-[10px]" },
  md: { circle: "w-6 h-6", text: "text-[10px]", name: "text-xs" },
  lg: { circle: "w-8 h-8", text: "text-xs", name: "text-sm" },
};

export function RouteBadge({
  slug,
  line,
  size = "md",
  showName = false,
  className = "",
}: RouteBadgeProps) {
  const resolvedLine = line || (slug ? getLineForCollection(slug) : DEFAULT_LINE);
  const s = sizes[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`${s.circle} rounded-full inline-flex items-center justify-center font-mono font-medium ${s.text} leading-none`}
        style={{ backgroundColor: resolvedLine.color, color: resolvedLine.color === "#FCCC0A" ? "#141414" : "#FFFFFF" }}
        aria-label={resolvedLine.name}
      >
        {resolvedLine.abbr}
      </span>
      {showName && (
        <span className={`font-mono ${s.name} text-muted`}>
          {resolvedLine.name}
        </span>
      )}
    </span>
  );
}
```

**Commit:** `feat: add RouteBadge component for MTA-style collection badges`

---

### Task 6: White Band Divider Component

Create a simple divider component that mimics MTA sign construction.

**Files:**
- Create: `components/ui/WhiteBand.tsx`

**Code:**

```tsx
interface WhiteBandProps {
  strong?: boolean;
  className?: string;
}

export function WhiteBand({ strong = false, className = "" }: WhiteBandProps) {
  return (
    <div
      className={`w-full ${strong ? "white-band-strong" : "white-band"} ${className}`}
      role="separator"
    />
  );
}
```

**Commit:** `feat: add WhiteBand divider component`

---

### Task 7: NavBar — Station Signage

Rebuild the navigation as subway station wayfinding signage.

**Files:**
- Modify: `components/ui/NavBar.tsx`

**Key changes:**
1. Background: `bg-void/95` → `rgba(20,20,20,0.85)` (subway glass effect)
2. Add a `WhiteBand` at the bottom edge of the nav
3. Left: Sheep mark + "AFTER HOURS AGENDA" (keep monospace, keep tracking)
4. Right: "SHOP" (monospace, uppercase) + Cart icon
5. Hover states: `text-cream` hover → `text-white` (order.design pattern: muted → pure white)
6. Mobile menu: Replace with "station directory" — full-screen black with collection line badges listed vertically, each with RouteBadge
7. Remove gold accent entirely from nav — the subway is white-on-black with colored badges only

**Mobile menu links** become:
```
●BS  Black Sheep     →
●NK  No Kings        →
●NM  Night Mode      →
●NY  NYC Forever     →
●NA  New Arrivals    →
────────────────────────
About
FAQ
Contact
```

**Commit:** `feat: rebuild navbar as subway station signage`

---

### Task 8: AnnouncementBar — Service Announcement

Restyle as a subway LED announcement board.

**Files:**
- Modify: `components/ui/AnnouncementBar.tsx`

**Changes:**
1. Background: Keep `bg-void` (black)
2. Add `white-band` (bottom border) instead of no border
3. Text: `font-mono text-[11px] text-muted tracking-[0.15em]` — wider tracking, more mechanical
4. Messages stay the same but format: `FREE SHIPPING ON ORDERS $75+  ·  TRACKED DELIVERY  ·  30-DAY RETURNS`
5. No fade transition — instant swap (like an LED board cycling)

**Commit:** `feat: restyle announcement bar as LED service board`

---

### Task 9: Hero — Entering the Station

Rebuild Entrance.tsx with subway station entrance energy.

**Files:**
- Modify: `components/homepage/Entrance.tsx`

**Structure:**
- Full-viewport dark section (`bg-void`, `min-height: 100vh`)
- Sheep silhouette centered and large (like a station mosaic) — `max-w-[400px]` on desktop, lower opacity (`opacity-20`)
- Text overlaid centered below the sheep:
  - "BUILT FOR THE ONES STILL MOVING" — `font-display font-bold text-hero` (all caps)
  - `after hours agenda — est. nyc` — `font-mono text-sm text-muted tracking-[0.2em]`
- Thin safety-yellow stripe at very bottom: `border-b-2 border-line-yellow`
- NO animation on load. Content is just there. (order.design principle)
- NO CTA button in hero (order.design doesn't have CTAs in heroes)
- Remove the 2-column split layout — go centered/stacked

**Commit:** `feat: rebuild hero as subway station entrance`

---

### Task 10: Line Directory — Collection Route Selector

Create a new component: the horizontal subway line selector strip.

**Files:**
- Create: `components/homepage/LineDirectory.tsx`

**Structure:**
```
<section className="py-8 px-6">
  <WhiteBand />
  <div className="max-w-7xl mx-auto py-8 flex flex-wrap items-center gap-x-8 gap-y-4 justify-center">
    {collections.map(col => (
      <Link href={`/collections/${col.slug}`}>
        <RouteBadge slug={col.slug} size="lg" showName />
      </Link>
    ))}
  </div>
  <WhiteBand />
</section>
```

**Props:** `{ collections: Collection[] }`

**Commit:** `feat: add LineDirectory subway route selector`

---

### Task 11: Featured Products — Platform Display (Asymmetric)

Rebuild LatestDrop.tsx with order.design's asymmetric layout.

**Files:**
- Modify: `components/homepage/LatestDrop.tsx`

**Key changes:**
1. Remove the current hero-product + sidebar layout
2. Replace with alternating asymmetric rows:
   - Row 1: Large image (65-70% width) + small image (25-30% width)
   - Row 2: Small image (25-30%) + large image (65-70%)
3. Product title sits ABOVE each image (order.design pattern):
   ```
   Product Name  ●BS                    $65.00
   ┌──────────────────────────────┐
   │                              │
   │      PRODUCT IMAGE           │
   │                              │
   └──────────────────────────────┘
   ```
4. Font: Product name in `font-mono text-sm text-muted`, price in `font-mono text-sm text-muted` right-aligned
5. Hover: text goes from `text-muted` → `text-white` (not gold)
6. Images: NO borders, NO rounded corners, NO card shadows — floating on darkness
7. Generous spacing: `gap-y-20` between rows
8. Section heading: `"New This Week"` in `font-mono text-label text-muted uppercase` — minimal

**Commit:** `feat: rebuild featured products with asymmetric layout`

---

### Task 12: Trust Strip — Service Announcement Board

Rebuild ThePromise.tsx as a subway announcement panel.

**Files:**
- Modify: `components/homepage/ThePromise.tsx`

**Changes:**
1. Background: `bg-void` (not charcoal — keep it dark)
2. White bands top and bottom (`WhiteBand` component)
3. Content as a single centered line in monospace:
   ```
   FREE SHIPPING $75+  ·  30-DAY RETURNS  ·  TRACKED DELIVERY
   ```
4. Remove the 3-column grid with icons — just one line of mono text
5. Text: `font-mono text-xs text-muted tracking-[0.1em]`
6. Centered, padded `py-6`
7. Feels like the scrolling LED text on subway platforms

**Commit:** `feat: rebuild trust strip as subway announcement panel`

---

### Task 13: MostWanted — Asymmetric Product Grid

Rebuild with order.design's varying-size module pattern.

**Files:**
- Modify: `components/homepage/MostWanted.tsx`

**Changes:**
1. Replace uniform grid with asymmetric layout
2. First row: 1 product at ~60% width + 1 product at ~35% width
3. Second row: 2 products at ~45% each
4. Third row: 1 product at ~35% + 1 product at ~60% (reversed)
5. Product title + RouteBadge ABOVE each image
6. Price right-aligned in monospace
7. Hover: title `text-muted` → `text-white`
8. Section header: keep "Most Wanted" but in `font-display font-bold text-section`
9. "View All →" link becomes `font-mono text-xs text-muted hover:text-white underline`
10. Remove "View All" from mobile — too much for small screens

**Commit:** `feat: rebuild most wanted with asymmetric module layout`

---

### Task 14: Editorial Gallery — Station Mosaics

Simplify the gallery to order.design's pure image layout.

**Files:**
- Modify: `components/homepage/EditorialGallery.tsx`

**Changes:**
1. Background: `bg-void` (not charcoal — images on pure darkness)
2. Asymmetric: 1 large (65%) + 1 small (30%), then 1 full-width
3. NO borders, NO rounded, NO card wrappers
4. Images float on darkness with ~40px gap
5. Add a small `font-mono text-label text-muted` caption below the section: something like `"shot on location — new york city"`
6. This section is where future subway mosaic artwork will live

**Commit:** `feat: simplify editorial gallery to pure asymmetric images`

---

### Task 15: Brand Story — Station Plaque

Rebuild Agenda.tsx as a bronze station plaque.

**Files:**
- Modify: `components/homepage/Agenda.tsx`

**Changes:**
1. Background: `bg-void`
2. White bands top and bottom
3. Centered content, `max-w-2xl mx-auto`
4. Small sheep silhouette above: `w-12 h-12 opacity-15` (like a transit authority seal)
5. Heading: `"UNIFORM FOR THE RELENTLESS"` — `font-display font-bold text-chapter uppercase`
6. Body in `font-body text-sm text-muted leading-relaxed`
7. Clean, minimal, quiet — no animation trickery

**Commit:** `feat: rebuild brand story as subway station plaque`

---

### Task 16: Collections — Line Map

Rebuild Collections.tsx as a subway line directory.

**Files:**
- Modify: `components/homepage/Collections.tsx`

**Changes:**
1. Background: `bg-void`
2. White band at top
3. Each collection is a horizontal row (not a card grid):
   ```
   ●BS  Black Sheep ──────────────── Explore →
        NYC-born streetwear for rebels

   ●NK  No Kings ─────────────────── Explore →
        Authority is earned, not given
   ```
4. RouteBadge on the left, name in `font-mono text-sm text-cream`, description in `text-muted`
5. "Explore →" right-aligned, `font-mono text-xs text-muted hover:text-white`
6. White band between each row (subtle dividers)
7. This looks like a subway directory / transfer map
8. Hover: row background subtly lightens (`hover:bg-surface`)

**Commit:** `feat: rebuild collections as subway line directory`

---

### Task 17: Email Signup — Arrival Board

Rebuild GetOnTheList.tsx as a train arrival display.

**Files:**
- Modify: `components/homepage/GetOnTheList.tsx`

**Changes:**
1. Background: `bg-void`
2. White bands top and bottom
3. Heading: `"NEXT ARRIVAL: YOUR INBOX"` in `font-mono text-sm text-muted uppercase tracking-[0.15em]`
4. Input: No box border — just a bottom white band underline (like a form field on a dark surface). `bg-transparent border-b border-muted focus:border-cream`
5. Button: Small, monospace, cream text on transparent: `"SUBSCRIBE →"` with `hover:text-white`
6. Success text: `font-mono text-xs text-line-green` (subway green = success)
7. Error text: `font-mono text-xs text-line-red` (subway red = alert)
8. Very minimal — 2 lines of content total

**Commit:** `feat: rebuild email signup as arrival board`

---

### Task 18: Homepage Reorder

Update app/page.tsx with the new section flow and new component.

**Files:**
- Modify: `app/page.tsx`

**New order:**
1. `Entrance` — hero / station entrance
2. `LineDirectory` — subway line badges (NEW, needs import + collections prop)
3. `LatestDrop` — featured products, asymmetric
4. `ThePromise` — trust announcement
5. `MostWanted` — product grid, asymmetric
6. `EditorialGallery` — station mosaics
7. `Agenda` — brand story plaque
8. `Collections` — line directory
9. `GetOnTheList` — arrival board signup

**Changes:**
- Add `import { LineDirectory } from "@/components/homepage/LineDirectory";`
- Add `<LineDirectory collections={collections} />` after Entrance
- Keep all data fetching logic unchanged

**Commit:** `feat: reorder homepage sections for subway station flow`

---

### Task 19: Footer — Station Exit

Rebuild Footer.tsx as a subway station exit panel.

**Files:**
- Modify: `components/ui/Footer.tsx`

**Changes:**
1. White band at top (strong)
2. Layout: 3 columns — Info / Contact / Lines
3. Column 1 "Info": Brand tagline `"EVERYTHING IS AFTER HOURS"` in mono, then address-style info
4. Column 2 "Contact": Phone, email, social links — all monospace
5. Column 3 "Lines": All 5 RouteBadges listed vertically with names
6. Sheep silhouette centered below columns: `w-20 h-20 opacity-10`
7. Bottom bar: Copyright + social icons + `↑` back-to-top link
8. All hover states: `text-muted` → `text-white` (NOT gold)
9. Link styling: `underline underline-offset-4` on hover (order.design pattern)

**Commit:** `feat: rebuild footer as station exit panel`

---

### Task 20: Shop Page — The Full Map

Rebuild ShopContent.tsx with grid/index dual view and asymmetric layout.

**Files:**
- Modify: `components/shop/ShopContent.tsx`
- Modify: `app/shop/page.tsx`

**ShopContent changes:**
1. Add view toggle: Grid (visual) vs Index (list) — `font-mono text-xs` buttons
2. Collection filter buttons become RouteBadge components
3. **Grid view**: Asymmetric layout — first product spans 2 cols, rest in varying sizes
4. **Index view** (NEW): Flat horizontal rows like order.design's /index page:
   ```
   Product Name  ●BS  ─────────────── $65.00
   Product Name  ●NK  ─────────────── $85.00
   ```
   Each row has a white band divider. Thumbnail appears on right on hover.
5. Sort dropdown stays but styled: `font-mono text-xs bg-transparent border-b border-muted`
6. Product count: `font-mono text-[11px] text-muted`
7. Hover: `text-muted` → `text-white`
8. Remove uniform 4-column grid

**Shop page changes:**
- Heading "SHOP" stays
- Add subtitle in mono: `"All lines — all collections"`
- Pass collections to ShopContent for badge rendering

**Commit:** `feat: rebuild shop with asymmetric grid and index view`

---

### Task 21: Product Detail — Station Information Panel

Rebuild ProductDetail.tsx with MTA signage styling.

**Files:**
- Modify: `components/product/ProductDetail.tsx`

**Changes:**
1. Breadcrumb: Add RouteBadge inline: `Shop / ●BS Black Sheep / Sheep Min`
2. Product image: No borders, no rounded — floating on `bg-void` (order.design style)
3. Thumbnail strip: White band above, no borders on thumbnails except active = `border-b-2` with collection line color
4. Right side:
   - RouteBadge (large) + collection name in mono
   - Product name in `font-display font-bold text-3xl`
   - Price in `font-mono text-2xl text-cream`
   - White band divider
   - Size selector as mini circles (styled like small route badges)
   - "ADD TO BAG" button: background = collection's line color, text = white (or dark for yellow)
   - Feedback state: "ADDED TO BAG ✓" in the same color
   - White band divider
   - Trust info in mono below
5. Related products: Asymmetric layout with RouteBadge on each
6. Remove gold accent throughout — replaced by dynamic collection color

**Commit:** `feat: rebuild product detail as station information panel`

---

### Task 22: Cart Drawer — Quick Transfer

Update CartDrawer.tsx with subway styling.

**Files:**
- Modify: `components/cart/CartDrawer.tsx`

**Changes:**
1. Header: "YOUR BAG" stays, add white band below
2. Drawer background: `bg-void` (not `bg-surface`)
3. Each item: Show RouteBadge if product has a collection ID
4. Remove rounded corners on images
5. Quantity buttons: `border border-muted` (not `border-border`), monospace text
6. Subtotal row: White band above, `font-mono`
7. "CHECKOUT" button: `bg-cream text-void` (keep it simple, cream = action)
8. Trust line: `font-mono text-[10px] text-muted tracking-[0.1em]`
9. Hover states: `text-muted` → `text-white`

**Commit:** `feat: restyle cart drawer with subway aesthetic`

---

### Task 23: Static Pages — Consistent Subway Styling

Update remaining pages to use the new color system.

**Files:**
- Modify: `app/about/page.tsx`
- Modify: `app/faq/page.tsx`
- Modify: `app/contact/page.tsx`
- Modify: `app/shipping/page.tsx`
- Modify: `app/privacy/page.tsx`
- Modify: `app/returns/page.tsx`
- Modify: `app/collections/[slug]/page.tsx`

**Changes (all files):**
1. Replace `text-gold` → `text-cream` (accent becomes primary text, no gold)
2. Replace `border-gold` → `border-muted`
3. Replace `hover:text-gold` → `hover:text-white`
4. Replace `bg-charcoal` → `bg-void` where it's section backgrounds
5. Add white band dividers between sections
6. In `collections/[slug]/page.tsx`: Add RouteBadge to the collection header

**Commit:** `chore: update static pages with subway color system`

---

### Task 24: Global Cleanup — Kill All Gold

Final pass to remove ALL remaining gold references and ensure consistency.

**Files:**
- All component files

**Steps:**
1. `grep -r "text-gold\|bg-gold\|border-gold\|hover:text-gold" --include="*.tsx" --include="*.ts"` and replace ALL with subway equivalents
2. `grep -r "#C8A961" --include="*.tsx" --include="*.ts" --include="*.css"` and replace
3. Verify the only gold references remaining are in `tailwind.config.js` (legacy alias)
4. Run `npm run build` to ensure no breakage

**Commit:** `chore: final cleanup — remove all gold accent references`

---

### Task 25: Build Verification & Deploy

**Steps:**
1. Run `npm run build` — expect clean build with zero errors
2. Verify all pages render correctly:
   - `/` (homepage)
   - `/shop` (shop page)
   - `/product/[any-slug]` (PDP)
   - `/collections/[any-slug]` (collection page)
3. Push to GitHub: `git push origin main`
4. Deploy to Netlify: `npx netlify-cli deploy --prod`
5. Verify live site at https://afterhoursagenda.netlify.app

**Commit:** N/A (deploy only)

---

## Task Dependency Map

```
Task 1 (Colors) ──┬── Task 2 (Globals) ──── Task 3 (Layout)
                   │
                   └── Task 4 (Line Config) ── Task 5 (RouteBadge) ── Task 6 (WhiteBand)
                                                        │
                   ┌────────────────────────────────────┘
                   │
                   ├── Task 7 (NavBar)
                   ├── Task 8 (AnnouncementBar)
                   ├── Task 9 (Hero)
                   ├── Task 10 (LineDirectory) ─┐
                   ├── Task 11 (LatestDrop)     │
                   ├── Task 12 (ThePromise)     ├── Task 18 (Homepage Reorder)
                   ├── Task 13 (MostWanted)     │
                   ├── Task 14 (Gallery)        │
                   ├── Task 15 (Agenda)         │
                   ├── Task 16 (Collections)    │
                   ├── Task 17 (Signup)  ───────┘
                   ├── Task 19 (Footer)
                   ├── Task 20 (Shop)
                   ├── Task 21 (ProductDetail)
                   ├── Task 22 (CartDrawer)
                   ├── Task 23 (Static Pages)
                   └── Task 24 (Cleanup) ── Task 25 (Deploy)
```

Tasks 7–17 and 19–22 can be done in any order after Tasks 1–6.
Task 18 depends on Task 10 (new component) but not on the others.
Task 24 must be last code task. Task 25 is deploy.
