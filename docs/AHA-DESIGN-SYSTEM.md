# After Hours Agenda website design system

Current direction: October 20, 2026, approved photography-first storefront. These website decisions supersede the older origami layout and brand-name copy themes. Keep payment-provider branding and functional commerce contracts intact.

## Palette and identity

- Paper `#FAFAFA`: page ground and light surfaces.
- Ink `#1A1A1A`: primary type, dark panels and primary action on Rose.
- Rose `#FF6B6B`: benefit strip, homepage statement panel and action fills, with Ink labels.
- Accessible Rose `#CE3D56`: text and focus on Paper. Never use light Rose as small text on Paper.
- Neutral grey is for supporting text, controls and hairline frames. No pink page grounds or new accent palette.
- Use the official black sheep and wordmark. Never invent replacement branding or a generic icon library.
- No decorative link/button arrows, including Unicode arrows. Use descriptive text and verified custom assets when appropriate.

## Type and layout

Poppins 400/700/900, with JetBrains Mono for compact metadata. Body and form inputs are at least 16px; metadata is at least 12px. Display headlines are uppercase and heavy; product names remain readable mixed case. Use Paper, hairlines, square edges, strong photography and generous space. Avoid decorative folds, unrelated panels and generic feature cards.

The shared header is stable and sticky. Desktop uses Shop, Lookbook, The story and Here to help. Phone and tablet use Menu with the same categories, search and help paths. The native modal has a visible Close control, focus containment, Escape dismissal and focus restoration. Keep the Bag reachable.

## Homepage and imagery

The approved headline is **GET COMFORTABLE MAKING AN IMPRESSION.** The primary CTA is **Shop it all**. Its three-panel composition uses two garment-led photographs around Rose type. On phone and tablet the photographs lead, followed by the same headline and action.

Keep `src/data/photography.json` for the approved editorial shoot. Editorial overrides never replace the product's four garment-only gallery images, Square identifiers, variants, price or approved print art. Match every photograph's link and caption to the garment pictured. Disclose AI-generated campaign imagery and identify archive material. Use AVIF with WebP fallback, explicit dimensions, responsive sizes, priority for the lead photo and native lazy loading below the fold.

All garment-only views share a white studio background. Use the supplied garment pixels and conventional masking for background cleanup, with originals retained and every view inspected. Keep actual fabric texture in close-ups, preserve fine garment edges and supplied source metadata, and use versioned URLs with accurate responsive widths. The image composer defaults to white for future mockups.

## Motion and access

Animate headline, captions and frame details once on entry. The garment photographs remain sharp and visible. Animate only transform/opacity. Modal exits are faster than entrances; repeated input interrupts safely. Respect reduced motion, native scrolling, safe areas, 44px controls, visible keyboard focus and WCAG AA contrast. No scroll hijacking.

## Customer language

Write about clothing: graphic, fabric, cut, construction, fit, styling and useful purchase information. The full brand name is identification only. Never turn “After Hours” or “Agenda” into a creative hook, metaphor, nightlife theme, schedule or calendar reference. Approved artwork and product names remain exact. No invented reviews, urgency, bestseller claims or unverified quality promises.

## Shopping and supporting pages

The shop starts with **YOUR NEXT FAVORITE.** Use one clear grid, garment filters and search. Design landing pages show the design's campaign and actual garment choices. Product pages show the four garment images, explicit sizing, fit/fabric, shipping, returns and care. The phone carousel and quick-add bar keep the next step in reach. Preserve static/runtime product-page parity.

The Lookbook headline is **Out & About It.** It carries one varied set per design family. The story keeps the factual 2011 origin and 2012 archive alongside current clothing. Help is concise and links to the page owning each topic. Policy terms stay complete. Home, Updates and the footer retain the existing one-form-per-page sign-up rule. Bag, account and order screens share the same typography and controls without extra marketing distractions.

## Validation

Use the active `site-preview/` checks on Node 24.21.0: lint, types, build, unit/artifact tests and the real-Chrome browser suite with external writes blocked. Keep each public route below 65 KB initial first-party JavaScript and 24 KB Brotli; cap the complete public first-party pool at 85 KB and the separately sampled web-vitals vendor at 12 KB. Optional fit/photo dialogs load on interaction. These October 21 budgets replace the historical combined-page pool limit while explicitly protecting actual page load. Review phone, tablet, desktop, landscape, narrow reflow, reduced motion and keyboard behavior. Never manufacture a payment, customer, message or analytics event as proof. Publish only through the authorized exact AHA Netlify property, then verify source, release receipt and live browser output.
