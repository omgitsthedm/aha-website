# CLAUDE.md — After Hours Agenda (AHA) E-Commerce Site

These instructions are **always relevant** to any task in this repository.

## Prime Directive
- After Hours Agenda is a **NYC streetwear brand** selling primarily online.
- The website must feel **premium, bold, and intentional** — never generic, never templated.
- Every change must protect the **purchase flow** above all else. If the cart or checkout breaks, nothing else matters.
- AHA is now live on the real custom domain. Treat this as production commerce, not a staging site.

---

## Governing Build Doctrine (§47)

This project is governed by `docs/MASTER-BUILD-INSTRUCTION.md` (the full ecommerce build spec, installed 2026-07-08) and, when supplied, `MASTER-UIUX-HANDOFF-v2.md`. **The UI/UX handoff doc is currently MISSING from the repo — provide it or the build instruction + this file serve as doctrine.**

- **Primary archetype:** D2 — E-Commerce / DTC Store. **Secondary:** D1 — Marketing / Brand Site.
- **Stack:** Netlify hosting/runtime · GitHub code/actions/release control · Square payments · Printful **API v2 beta** fulfillment. (Current repo: Next.js 14 App Router — adapt the spec's structure to it, don't impose Astro/`src/`.)
- **Critical rules:** Useful>beautiful · Clear>clever · Fast>flashy · Accessible by default · Honest persuasion only · No fake urgency/scarcity/reviews · No hidden costs · No forced account before checkout · No unmapped products purchasable · No client-side Square/Printful secrets · No Printful fulfillment before Square payment success · No Printful live confirmation outside production flags (`PRINTFUL_ALLOW_CONFIRM_ORDERS=true` + `PRINTFUL_LIVE_MODE=true`) · Square SDK loads only on checkout/payment · Printful v2 beta is the required fulfillment target · AHA owns the storefront product layer because v2 has no sync products/templates.
- **Every work session must end with:** what changed · files touched · tests run · risks · remaining gaps · next recommended step.

---

## Current Production Truth

- Canonical branch: `main`
- Current deployed commit: `13c25e83f696b19c7d9230ec4766900cc5485451`
- Netlify project: `afterhoursagenda`
- Netlify site id: `275b4115-16bf-42fb-9b36-6bce9bb93608`
- Netlify admin: `https://app.netlify.com/projects/afterhoursagenda`
- Default Netlify URL: `https://afterhoursagenda.netlify.app`
- Primary custom URL: `https://afterhoursagenda.com`
- `www` redirects to apex: `https://www.afterhoursagenda.com -> https://afterhoursagenda.com`
- Latest verified production deploy id: `6a4f2851e4c1b9fb71f86a67`
- PR #2 merged the current storefront/backend readiness work into `main`.
- GitHub Action `Claude Code Review` failed only because Claude account billing was locked per handoff; it was not a verified app/build failure.

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
- Netlify is now Git-linked to `https://github.com/omgitsthedm/aha-website`, branch `main`.
- Normal production deploys should be Git-backed from reviewed `main`.
- Avoid manual production deploys except for a scoped emergency restore.
- After any production deploy, run `npm run verify:netlify-live` and confirm the live page contains After Hours Agenda content and no wrong-site content.
- After custom-domain changes, run `LIVE_URL=https://afterhoursagenda.com/ npm run verify:netlify-live`.
- Commerce env readiness must pass before relying on checkout/webhook behavior: `npm run verify:commerce-readiness:netlify`.
- Known platform gap as of 2026-07-08 21:57 MST: Netlify is Git-linked, but API still reports `prevent_non_git_prod_deploys: false`. Keep exact site verification in place.
- `netlify.toml` is configured — don't modify without good reason.
- Build command: `npm run build`
- Publish directory: `.next`
- Environment variables must be set in Netlify dashboard (never committed).
- Always run `npm run build` locally before pushing to catch build errors.

### Current Commerce Caveats

- No live checkout was run during the custom-domain cutover.
- No Square order was created.
- No Printful fulfillment was triggered.
- Webhook routes verify signatures and acknowledge/log events only. They do not create Printful orders or automate fulfillment.
- Handoff says the Square production webhook was created at `https://afterhoursagenda.netlify.app/api/webhooks/square`, but Netlify production currently reports non-secret `SQUARE_WEBHOOK_NOTIFICATION_URL=https://www.afterhoursagenda.com/api/webhooks/square`. Square signature verification requires an exact URL match. Confirm and align before relying on Square webhooks.
- David does not want rigid magic approval phrases going forward. For high-risk live changes, ask for clear scoped plain-language confirmation and restate the exact action before doing it. If generated `.ai/RULES.md` still conflicts, pause and clarify rather than taking live action.

---

## Before Deploying Checklist
1. `npm run build` passes with no errors.
2. `npm run verify:netlify-site` passes for the exact target site.
3. `npm run verify:commerce-readiness:netlify` passes if commerce backend behavior matters.
4. Cart and checkout entry are smoke-tested without creating live orders.
5. Live checkout/payment is tested only through a David-approved safe path.
6. Product pages render with live Square/Printful data.
7. Mobile layout is tested and looks premium.
8. No hardcoded API keys, secrets, or test data in the codebase.
9. No unnecessary `console.log` statements left in production code.
10. Sitemap and robots.txt are generating correctly.

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
