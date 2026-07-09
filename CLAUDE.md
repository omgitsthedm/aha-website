# CLAUDE.md — After Hours Agenda (AHA) E-Commerce Site

These instructions are **always relevant** to any task in this repository.

## Prime Directive
- After Hours Agenda is a **NYC streetwear brand** selling primarily online.
- The website must feel **premium, bold, and intentional** — never generic, never templated.
- Every change must protect the **purchase flow** above all else. If the cart or checkout breaks, nothing else matters.

---

## Tech Stack
- **Next.js 14** (App Router) with **TypeScript**
- **Tailwind CSS** for styling
- **GSAP** for animations
- **Square API** for payments and order management
- **Printful API** for product catalog, mockups, and fulfillment
- **Netlify** for deployment (with `@netlify/plugin-nextjs`)

---

## Project Structure
```
app/             → Pages and routes (App Router)
  api/           → API routes (Square checkout, Printful webhooks, etc.)
  shop/          → Product listing / collections
  product/       → Individual product pages
  cart/          → Shopping cart
  collections/   → Collection pages
components/      → React components organized by feature
  cart/          → Cart UI components
  checkout/      → Checkout flow components
  homepage/      → Landing page sections
  product/       → Product display components
  seo/           → SEO/meta components
  shop/          → Shop listing components
  ui/            → Shared UI primitives
lib/             → Business logic and API integrations
  square/        → Square API client, catalog, orders
  printful/      → Printful API client, catalog, mockups, shipping
  cache/         → Caching utilities
  utils/         → Shared helpers
content/         → Static content / copy
public/          → Static assets
styles/          → Global styles
```

---

## Critical Rules

### Never Break the Purchase Flow
- **Cart → Checkout → Payment → Confirmation** must always work.
- Test any change that touches `lib/square/`, `lib/printful/`, `app/api/`, `app/cart/`, or `components/checkout/` with extreme care.
- Never hardcode prices, product IDs, or inventory counts — always pull from Square/Printful APIs.

### API Integration Rules
- **Square** is the source of truth for: payments, orders, and transaction records.
- **Printful** is the source of truth for: product catalog, variants, mockup images, and fulfillment/shipping.
- Never cache product prices for more than the current request cycle. Prices must always reflect the live catalog.
- API keys and secrets live in environment variables, **never** in code.

### TypeScript
- All new code must be TypeScript. No `any` types unless absolutely unavoidable.
- Prefer interfaces over type aliases for object shapes.
- API response types should be defined in the corresponding `lib/` module.

---

## Design Standards

### UI / UX Doctrine
- Follow `MASTER UI / UX / PRODUCT HANDOFF — v2` as the current Little Fight NYC product doctrine.
- For AHA, classify the product as **E-Commerce / DTC Store** first, with content/editorial surfaces second.
- Every storefront change must improve shopper comprehension, task completion, trust, speed, accessibility, or honest conversion.
- PDPs must show price, size/variant choice, production/delivery expectations, return summary, full-image access, and an Add to Bag action before the shopper has to leave the page.
- Cart and checkout-entry surfaces must show subtotal, shipping expectation, tax expectation, fulfillment expectation, support path on error, and Square/wallet handoff language before payment.
- No fake urgency, fabricated scarcity, hidden fees, forced account creation, newsletter popups before value, or vague checkout CTAs.
- Accessibility statement, visible focus, touch targets, semantic labels, reduced-motion respect, and mobile-first layouts are part of done.

### Brand Feel
- **Bold, minimal, confident.** Not cluttered, not loud.
- Dark palette with high-contrast accents. The brand should feel like it belongs on a night street in NYC.
- Typography should be sharp and modern.
- Whitespace is a design tool — use it generously.

### Mobile First
- Every page and component must look great on mobile **first**, then scale up to desktop.
- Touch targets: minimum 44px.
- Product images must be fast-loading and swipeable on mobile.
- Cart and checkout must be effortless on a phone.

### Animations (GSAP)
- Keep animations tasteful and purposeful — they should enhance, not distract.
- Respect `prefers-reduced-motion`.
- Page transitions and scroll reveals should feel smooth, not flashy.
- Product image interactions should feel premium (hover zooms, smooth transitions).

---

## Performance
- **Lighthouse Performance: 90+** target.
- Images: Use Next.js `<Image>` component. WebP format preferred.
- Lazy load anything below the fold.
- Minimize client-side JS — use Server Components by default, only add `"use client"` when truly needed.
- API calls should be cached/deduped where safe (catalog data yes, prices cautiously, inventory never).

---

## SEO + AEO
- Every page needs: `title`, `meta description`, Open Graph tags.
- Product pages need structured data: `Product` schema with price, availability, images.
- Collection pages need `ItemList` schema.
- FAQ page uses `FAQPage` schema.
- Clean URLs: `/shop`, `/product/[slug]`, `/collections/[slug]`.
- Sitemap and robots.txt are generated dynamically (`app/sitemap.ts`, `app/robots.ts`).

---

## Deployment
- Deploys to **Netlify** project `afterhoursagenda`, site id `275b4115-16bf-42fb-9b36-6bce9bb93608`.
- Do not deploy by site name alone. Before any deploy, run `npm run verify:netlify-site`.
- Until Netlify Git linking is repaired, approved production restores must use the exact site id:
  `netlify deploy --prod --site 275b4115-16bf-42fb-9b36-6bce9bb93608`.
- After any production deploy, run `npm run verify:netlify-live` and confirm the live page contains After Hours Agenda content and no wrong-site content.
- Known platform gap as of 2026-07-08: Netlify still reports empty build settings and `prevent_non_git_prod_deploys: false`. Repair Git linking in Netlify and enable non-Git production deploy blocking before treating push-to-main as protected.
- `netlify.toml` is configured — don't modify without good reason.
- Build command: `next build`
- Environment variables must be set in Netlify dashboard (never committed).
- Always run `npm run build` locally before pushing to catch build errors.

---

## Before Deploying Checklist
1. `npm run build` passes with no errors.
2. Cart → Checkout → Payment flow works end-to-end.
3. Product pages render with live Square/Printful data.
4. Mobile layout is tested and looks premium.
5. No hardcoded API keys, secrets, or test data in the codebase.
6. No `console.log` statements left in production code.
7. Sitemap and robots.txt are generating correctly.

---

## Required Completion Report
When you finish any task, output:

**Completed:**
- (bullets)

**Needs from David:**
- (bullets)

**Purchase flow impact:** none / tested / needs testing

**Mobile checked:** yes / no / not applicable

**Build status:** passes / not tested
