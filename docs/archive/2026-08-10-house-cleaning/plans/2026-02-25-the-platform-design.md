# The Platform — AHA Subway Station Experience

## Overview

A complete visual redesign of After Hours Agenda that transforms the site into a NYC subway station experience. Merges **order.design**'s asymmetric editorial layout with the **MTA NYCTA Graphics Standards** design system — colored route badges, white-on-black signage, Helvetica typography, modular grid, and the iconic white band divider.

The goal: browsing the site should feel like standing on the 4/5/6 platform at 59th Street.

## Inspiration Sources

### order.design (Layout & Interaction)
- Near-black background (`rgb(20,20,20)`)
- Monospace body font ("Pitch Sans") — utilitarian, systems feel
- Asymmetric image layouts — modules range 19%–84% of viewport width
- Zero decoration — no cards, no borders, no shadows, no gradients
- No scroll animations — no GSAP, no parallax. Confidence to let work breathe.
- Project title + tag links ABOVE image (not overlaid)
- Fixed nav at 85% opacity, links left, logo right
- Tag-based flat navigation with underline hover states
- Hover = grey turns white. That's it.
- Generous whitespace (~120px between modules)

### MTA NYCTA Graphics Standards (Visual Language)
- White on black — high contrast signage
- Colored route badges — small circles that POP against black
- Modular grid — 1'×1' base panels combined into larger signs
- Helvetica — one typeface family for everything
- "Information at the point of decision" — never before, never after
- The white band — thin horizontal rule between sign sections (accidentally iconic)
- Color = categorization — group related routes by color

## Design System

### Colors

**Background**: `#141414` (slightly warm black — subway tunnel darkness)

**Text**:
- Primary: `#E8E4DE` (aged porcelain white — not pure white)
- Secondary/Muted: `#7A756E` (platform grey)
- Hover: `#FFFFFF` (pure white on hover, like order.design)

**Collection Line Colors** (authentic MTA):

| Collection | Subway Line | Color | Hex | Badge |
|---|---|---|---|---|
| Black Sheep | 1/2/3 | Red | `#EE352E` | ●BS |
| No Kings | A/C/E | Blue | `#2850AD` | ●NK |
| Night Mode | B/D/F/M | Orange | `#FF6319` | ●NM |
| NYC Forever | 4/5/6 | Green | `#00933C` | ●NY |
| New Arrivals | N/Q/R/W | Yellow | `#FCCC0A` | ●NA |

**Utility**:
- Safety yellow: `#FCCC0A` (announcements, warnings)
- Danger: `#EE352E`
- White band: `#E8E4DE` at ~20% opacity for dividers, full opacity for text

### Typography

**Display/Headings**: Inter — the modern Helvetica. Clean, legible, authoritative.
- Hero: `clamp(4rem, 12vw, 9rem)`, weight 700, tracking -0.03em
- Section: `1.875rem`, weight 700

**Data/Labels/Prices**: IBM Plex Mono — utilitarian system font
- Prices, product codes, navigation, badges, metadata
- Sizes: 11px (labels), 13px (body mono), 14px (prices)
- Tracking: 0.05em–0.15em depending on context

**Body**: Inter Regular — clean paragraph text
- Size: 14-15px, line-height: 1.6

### The White Band

The single most recognizable MTA sign element. Used throughout:
- `border-bottom: 1px solid rgba(232, 228, 222, 0.2)` for subtle section dividers
- `border-bottom: 1px solid #E8E4DE` for strong dividers (like under nav)
- Always horizontal. Never vertical. Consistent spacing above and below.

### Route Badges

Small filled circles with 2-letter collection codes:
- Circle: 24px diameter, filled with collection color
- Text: 11px IBM Plex Mono, white, centered
- Larger variant (32px) for collection headers and filters
- Inline with product names: `●BS  Black Sheep Hoodie`

## Page Designs

### Navigation — Station Signage

- Fixed position, `rgba(20,20,20,0.85)` background with backdrop-blur
- Left: Sheep mark (transit authority logo) + "AFTER HOURS AGENDA" monospace
- Right: "SHOP" monospace link + Cart icon with count badge
- Bottom edge: white band (1px)
- Height: ~80px
- Mobile: Three-dot hamburger → full-screen station directory with colored line badges

### Homepage — Arriving at the Station

**A. Hero ("Entering the Station")**
- Full-width dark section
- Sheep silhouette large and centered (like a station mosaic piece)
- Text overlay: "BUILT FOR THE ONES STILL MOVING" in display type
- Subtitle in monospace: `after hours agenda — est. nyc`
- Thin safety-yellow stripe along bottom edge
- NO animation. Image breathes.

**B. Line Directory ("Which Line?")**
- Horizontal strip with all collection badges
- Each: colored circle + collection name in monospace
- Clickable — filters featured products below
- White band above and below
- Centered layout, generous spacing

**C. Featured Products ("Platform Display")**
- order.design asymmetric layout: varying image widths
- Pattern: large (70%) + small (30%), then small (30%) + large (70%), alternating
- Product title ABOVE image in monospace with collection badge inline
- Price right-aligned in monospace
- Images have NO borders, NO cards — floating on darkness
- ~120px between product blocks
- Hover: title text goes from muted to white (order.design pattern)

**D. Trust Strip ("Service Announcement")**
- Full-width, black background
- White bands top and bottom
- Monospace text centered: `FREE SHIPPING $75+  ·  30-DAY RETURNS  ·  TRACKED DELIVERY`
- Styled like LED platform announcement boards

**E. Editorial Gallery ("Station Mosaics")**
- 2-3 large lifestyle images in order.design's asymmetric masonry
- No text overlays — pure imagery
- Future: actual subway-mosaic-style brand artwork
- For now: editorial photography floating on darkness

**F. Brand Story ("Station Plaque")**
- Centered block, white bands top and bottom
- Small sheep silhouette above (transit authority seal)
- "UNIFORM FOR THE RELENTLESS" in caps display type
- Body text in Inter Regular below
- Simple, bronze-plaque energy

**G. Email Signup ("Arrival Board")**
- Monospace: `NEXT ARRIVAL: YOUR INBOX`
- Input with bottom-border only (white band underline, no box)
- Submit as a colored badge button
- Minimal, utilitarian

### Shop Page — The Full Map

Two viewing modes:

**Grid View (default):**
- Collection badge filters at top (colored circles)
- Sort dropdown in monospace
- Asymmetric product grid — first product per row is larger
- Product card: image (no border) + title + badge + price
- Generous spacing, order.design rhythm

**Index View (toggle):**
- Flat horizontal list (like order.design's /index page)
- Each row: `Product Name  ●BS  ─────────── $65.00`
- Thumbnail appears on hover (right side)
- Search bar: monospace, `Type here and press return →`
- White bands between rows

### Product Detail — Station Information Panel

- White band breadcrumb at top: `Shop / ●BS Black Sheep / Sheep Min Hoodie`
- Left: Large product image (no border, floating — order.design style)
- Thumbnail strip below main image
- Right:
  - Collection badge (colored circle + full name)
  - Product name in display type
  - Price in large monospace
  - Size selector as mini route badges (circles)
  - "ADD TO BAG" button in collection color (full-width)
  - Trust info in monospace below white band
- Related products in asymmetric grid below

### Cart Drawer — Quick Transfer

- Slide-in from right (existing)
- "YOUR BAG" header with white band below
- Items listed with collection badge, name, price, quantity
- Remove styled as muted monospace link
- Footer: subtotal in monospace, checkout button in primary collection color
- Trust line: monospace, white band above

### Footer — Station Exit

- "EVERYTHING IS AFTER HOURS" tagline centered
- Three columns: Office (Address), Contact (email/social), Lines (collection badges)
- Sheep silhouette centered (transit authority mark, low opacity)
- All collection line badges listed horizontally at bottom
- Back-to-top: `↑` arrow
- White band at top

## Interaction Patterns

### From order.design:
- **Hover = subtle**: muted text → white. Underlines appear on links. That's it.
- **No scroll animations**: IntersectionObserver only for lazy-loading images, NOT for entrance effects
- **Image loading**: Blur-up placeholder → full image (gentle, no jarring pop)

### MTA-influenced:
- **Badge interactions**: Collection badges have hover glow in their line color
- **Filter transitions**: Instant swap (no fade/slide). Like changing a train line.
- **Page transitions**: Clean, no frills. Arrive, see content.

## Responsive Strategy

### Desktop (1280px+)
- Asymmetric layouts with multiple image sizes per row
- Fixed nav with full link set
- Side-by-side product detail layout

### Tablet (768px)
- Reduced asymmetry (2-column with varying sizes)
- Nav links condensed or hamburger
- Product detail stacks vertically

### Mobile (375px)
- Single column, full-width images (order.design mobile approach)
- Three-dot hamburger → full-screen station directory
- Product title + badge above image
- Bottom-sticky "ADD TO BAG" on product pages

## What's NOT Changing

- Square catalog API integration
- Cart/checkout flow logic
- Product data model
- API routes
- ISR revalidation (5 min)
- Next.js 14 / Tailwind 3 / TypeScript stack

## Future (Phase 2+)

- Actual subway mosaic tile artwork for brand logos and hero images
- Animated "train arriving" transitions between pages
- Collection pages styled as specific station platforms
- Interactive subway map as site navigation
- "Transfer" suggestions (related products) styled as station transfer signs
