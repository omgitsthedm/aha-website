# AHA UI/UX System v3

Status: governing project design doctrine as of 2026-07-10.

This system adapts `MASTER-UIUX-HANDOFF-v3-STREAMLINED-v2.md` to the After Hours Agenda storefront. It supersedes the former blacklight-grunge and subway presentation. Existing routes, catalog data, cart state, Square checkout, fulfillment contracts, and post-purchase behavior remain the functional wireframe. Their old visual treatment does not.

## 1. Product promise

After Hours Agenda is an independent New York streetwear label for people who make their own lane. The store must help a customer understand the point of view, find a product, choose a valid size, know what happens after purchase, review the final total, pay securely, and recover from failure without guessing.

Priority order:

1. Product truth
2. Comprehension
3. Task completion
4. Confidence with money and fulfillment
5. Accessibility
6. Brand expression

## 2. Visual direction: Black Sheep Newsstand

The interface is an independent editorial storefront, not a subway simulation, luxury template, or visual-effects demo.

- Base: near-black ink.
- Content: warm paper text and image surfaces.
- Brand signal: one accessible AHA pink.
- Typography: IBM Plex Mono plus one heavy system display face.
- Geometry: square, sharp, aligned, and ruled.
- Rhythm: generous page openings, compact commerce controls, clear section starts.
- Imagery: real AHA campaign and catalog assets before decorative generation.
- Texture: one quiet registration grid and subtle paper grain at page level only.

## 3. Wireframe contract

The route architecture is preserved:

- Home: proposition, explicit new-arrivals collection when populated, production promise, catalog edit, campaign, brand position, collections, newsletter.
- Shop and collection: page context, search, filters, sort, grid/index switch, product results, empty state.
- Product: breadcrumb, gallery, name and price, fit, size, availability, add to bag, delivery and return facts, description, related pieces.
- Bag: editable lines, unit and line totals, subtotal, shipping and tax explanation, checkout action.
- Checkout: contact, shipping address, authoritative quote, supported wallets, Square card field, exact charge action, order summary.
- Confirmation: verified order number, items, paid total, address, fulfillment timeline, receipt and support.
- Support and policy: direct answer first, contact path, no decorative filler.

## 4. Truth and persuasion rules

- Do not label products best sellers without verified sales ranking data.
- Do not call products new unless they belong to the populated New Arrivals collection.
- Do not imply limited supply, countdowns, demand, social proof, reviews, or urgency without evidence.
- Do not promise free exchanges, response times, international availability, or delivery methods unless operations prove them.
- Always state that products are made to order and show the production window.
- Standard shipping is free. Tax and final total are quoted before payment.
- If order confirmation cannot be verified in the current browser, do not clear the bag.

## 5. Commerce confidence mode

Payment and fulfillment surfaces use the same brand tokens with lower visual intensity:

- one accent action per decision point;
- 1px rules instead of cards inside cards;
- no decorative motion near payment;
- plain labels for subtotal, shipping, tax, and total;
- disabled Pay until address quote and Square card field are ready;
- persistent idempotency key across unknown network outcomes;
- error copy must say what happened and what the customer can do next.

## 6. Accessibility contract

- WCAG 2.2 AA is the target.
- Keyboard access and visible focus are required for all actions.
- Navigation, bag drawer, and add-to-bag dialog trap focus, close with Escape, lock background scroll, and restore focus.
- All controls have labels, roles, and state (`aria-pressed`, `aria-live`, or `role=alert`) where needed.
- Touch targets are at least 44 by 44 CSS pixels.
- Status never relies on color alone.
- Reduced-motion preference removes nonessential motion.
- Mobile order is product-first: image, identity, price, fit, size, action, then long detail.

## 7. Responsive contract

- Start at 320px and preserve readable text without horizontal page overflow.
- Filters wrap and remain operable without hidden controls.
- Product cards use two columns on small screens, then three and four as space allows.
- Checkout becomes one column with summary after payment inputs; desktop may use a sticky summary.
- Dialog and drawer actions remain reachable above safe-area insets.
- Tables may scroll inside their own region, not the page.

## 8. Component rules

- `PageHeader` owns route-opening hierarchy.
- `RouteBadge` is an editorial collection code, not a colored transit line.
- `.primary-action` owns solid AHA pink actions.
- Product grid and related-product cards share image ratios, title casing, and price treatment.
- Drawers and dialogs share focus and scroll behavior.
- New UI must use semantic Tailwind tokens from `tailwind.config.js`.
- Raw hex values in React components are a release blocker.

## 9. Removed systems

The following are intentionally deleted and must not be restored without a new approved direction:

- animated subway map;
- particle/dot canvas background;
- split-flap display;
- film-grain and scroll-reveal components;
- subway line color registry;
- multicolor neon collection treatment;
- metrocard gradient buttons;
- zine stickers, misprint effects, tape, rotation, glow, and collage utilities.

## 10. Release gates

Before release:

1. Lint and TypeScript pass with no warnings.
2. Unit tests and catalog validators pass.
3. Production build succeeds.
4. Static scan finds no raw legacy colors or removed visual vocabulary in runtime UI.
5. Home, shop, collection, product, bag, checkout, confirmation, and support routes are inspected at mobile and desktop sizes.
6. Keyboard flow, focus restoration, reduced motion, zoom, empty, loading, error, unavailable-size, and quote-failure states are verified.
7. Commerce readiness and live webhook blockers remain explicit. A visual release cannot hide an operational failure.
