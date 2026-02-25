# The Platform v2 — Full Underground Experience

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Transform the AHA website from clean subway-themed e-commerce into a fully immersive NYC subway station experience with theatrical animations, interactive navigation, and gritty atmospheric texture.

**Architecture:** GSAP 3 + ScrollTrigger for all animation, custom SVG subway map navigation, split-flap departure board components, turnstile cart interactions, CSS subway tile textures, AI-powered product background removal, and View Transitions API for page morphs.

**Tech Stack:** Next.js 14, GSAP 3 + ScrollTrigger + MotionPath, @imgly/background-removal-node, View Transitions API, CSS feTurbulence noise, CSS repeating-gradient tile patterns.

---

## 1. Mosaic Hero Entrance

- Full-bleed mosaic image (`/public/brand/mosaic-hero.png`) as hero
- GSAP parallax at 0.3× scroll speed
- CSS subway tile border frames the mosaic
- Dark gradient rises from below on scroll (descending into station)
- Safety-yellow platform edge stripe below hero
- Split-flap departure board under hero: "NOW SERVING: BLACK SHEEP · NO KINGS..."

## 2. SVG Subway Map Navigation

- Custom SVG with 5 colored lines connecting collection "stations"
- Click station → navigate to collection
- GSAP MotionPath: train slides along line on hover
- Lines draw themselves on scroll (stroke-dasharray)
- Stations pop in sequentially
- Mobile: vertical strip map (like inside-train display)
- Current page = pulsing station dot

## 3. Split-Flap Departure Board Component

- Reusable `<SplitFlap value="TEXT" />` component
- 3D CSS flaps with perspective + rotateX
- Characters cycle through alphabet before landing (authentic behavior)
- Dark bg (#1A1A1A), amber/cream text (#E8E4DE)
- Staggered left-to-right cascade via GSAP
- Used in: announcements, collection headers, prices, cart total, signup confirmation

## 4. Turnstile Add-to-Cart & MetroCard Cart

- "SWIPE TO ADD" button with MetroCard gradient
- GSAP clip-path swipe animation left-to-right on click
- Text flips to "FARE ACCEPTED" in green
- Turnstile arm SVG rotates alongside
- Cart icon shows MetroCard balance format ($XX.XX)
- Cart drawer header: "YOUR METROCARD"
- Checkout: "ENTER THE PLATFORM →"

## 5. Station Signage Wayfinding

- Directional arrows: "← Back to Platform" breadcrumbs
- Platform numbers: products get Track #01, #02...
- Overhead station banners on collection pages (line-color backgrounds)
- "NEXT TRAIN ARRIVING" for related products
- "SERVICE ADVISORY" for sale/low-stock items
- Transfer indicators for multi-collection products

## 6. Textures & Atmosphere

- CSS subway tile pattern (repeating-gradient brick with grout)
- Accent zones: hero border, section dividers, footer
- SVG feTurbulence noise overlay (opacity 0.05-0.12, mix-blend-mode)
- Applied to: hero, section backgrounds, footer, cart drawer
- Fog gradient at hero bottom
- Fluorescent flicker on product hover
- Animated grain shift on dark surfaces

## 7. Product Image Background Removal

- @imgly/background-removal-node in prebuild script
- ONNX model cached after first download
- Processes Square catalog images → transparent PNGs
- Cached by file hash (skip unchanged images)
- Graceful fallback (serve original if removal fails)
- Products display on void with subtle line-color ambient glow
- Hover: glow intensifies

## 8. GSAP Scroll Animations

- Hero parallax + scale-down on scroll
- Departure board flip-in on viewport entry
- Map line draw + station pop-in
- Products arrive from alternating sides (train-arrival style)
- Heading letter stagger reveal
- Gallery parallax depth layers
- Signup slides up like turnstile panel
- All on transform/opacity only (GPU-composited)
- will-change on animated elements
- prefers-reduced-motion: skip to final state

## 9. View Transitions API

- Page navigation: content slides out left, new slides in right (train departure/arrival)
- Brief dark flash with tile texture during transition
- Fallback: simple crossfade for unsupported browsers
- Applied to all internal navigation via Next.js router events
