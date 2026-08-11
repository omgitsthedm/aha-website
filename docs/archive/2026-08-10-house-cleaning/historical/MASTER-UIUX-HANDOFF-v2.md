# MASTER UI / UX / PRODUCT HANDOFF — v2
**Little Fight NYC · Universal Product Doctrine**
Version: July 8, 2026 (supersedes July 4, 2026)

Use this as the universal design, UX, engineering, and product doctrine for every digital product Little Fight NYC ships: local business sites, e-commerce stores, SaaS tools, specialized operator cockpits (e.g., Public House Creative Cockpit), and multi-sided platforms (e.g., VenueCircuit.app). It is written to be handed directly to Claude Code or any AI coding agent.

**How this document is organized:**
- **Part A — Doctrine:** the permanent philosophy and master rules
- **Part B — The 2026 Standards Layer:** legal, performance, accessibility, and AI compliance facts current as of July 2026
- **Part C — UX Psychology:** honest persuasion mechanics
- **Part D — Project-Type Playbooks:** how the doctrine adapts to each product archetype
- **Part E — System Architecture:** tokens, components, states, motion, theming
- **Part F — Page & Flow Rules:** per-surface requirements
- **Part G — Content & Voice**
- **Part H — AI-Native Interface Rules:** agentic UX, generative UI, transparency
- **Part I — Process:** build order, feature spec, acceptance criteria, QA gates
- **Part J — AI Coding Agent Instructions & Build Prompts**
- **Part K — Non-Negotiables & Final Standard**

---

# PART A — DOCTRINE

## A0. Purpose

Every product we ship must be:

- Useful before beautiful
- Clear before clever
- Fast before flashy
- Accessible by default
- Honest in its persuasion
- Calm in an attention-fragmented world
- Trustworthy with user data, money, and time
- Transparent about automation and AI
- Durable beyond visual trends
- Built with reusable systems, not isolated screens

Every UI decision must improve at least one of:

1. User comprehension
2. User task completion
3. User confidence
4. User trust
5. User speed
6. User accessibility
7. Product clarity
8. Business outcome without deception

If a visual, interaction, animation, or content block improves none of these, remove it.

**The 2026 addition to this purpose:** the interface is no longer only a set of screens the user operates — it increasingly includes systems that act *on the user's behalf*. The doctrine therefore covers two modes:

- **Direct manipulation:** user does the task; UI must make the task obvious.
- **Delegated execution:** user sets a goal; the system (often AI) executes; UI must make the *system's behavior* obvious — what it did, why, with what confidence, and how to override it.

A product feels "magical" when both modes are effortless AND legible. Magic without legibility is a trust debt that always comes due.

## A1. Core Philosophy

The interface should guide behavior without exploiting users.

Good digital design combines:

- **Dieter Rams-style restraint:** usefulness, honesty, clarity, durability, detail, "less but better"
- **UX psychology:** defaults, progress, reciprocity, ownership, loss aversion, contrast — used honestly
- **2026 requirements:** legal accessibility (EAA is now enforced), AI transparency (EU AI Act Article 50 is enforceable August 2, 2026), performance as a ranking and retention factor (INP era), calm design as a competitive advantage, token-based interoperable design systems (DTCG stable spec), and privacy-respecting data practices

The UI is the product's operating language, not a decoration layer.

Every screen must answer:

1. What is this?
2. Why does it matter?
3. What can the user do here?
4. What should the user do next?
5. What happens after they act?

And in 2026, a sixth question wherever automation exists:

6. What is the system doing on my behalf right now, and how do I stop or change it?

## A2. Master Rules

### Rule 1: Useful first
Every page, screen, component, and interaction serves a real user goal.

Design around what the user needs to understand or complete first — never around what the company wants to show first.

Bad: homepage leading with vague brand language; dashboard opening with decorative stats; checkout promoting add-ons before order basics; signup asking for data before giving value.

Good: homepage that immediately explains value; dashboard that shows what needs attention; checkout that clearly shows items, price, delivery, payment, confirmation; signup that lets the user preview or create first.

**Implementation rule:** every route must have a primary user task. No clear task → the route should not exist yet.

### Rule 2: Clear before clever
Clarity beats personality, cleverness, trendiness, and visual novelty.

Buttons describe outcomes, not gestures.

Bad CTAs: Get Started · Continue · Submit · Learn More · Click Here
Good CTAs: Save report · Start order · Add to cart · Book venue · Create account · Download invoice · Send inquiry · View today's tasks

**Implementation rule:** if a first-time user has to guess what a control does, the label is wrong.

### Rule 3: Less, but better
Use the least interface necessary to help the user understand and act.

Remove: decorative cards with no action, unnecessary icons, redundant labels, repeated CTAs, effects that reduce readability, animations that don't explain state, empty sections, filler copy, unnecessary form fields, unnecessary modals, unnecessary onboarding steps.

Keep: clear hierarchy, clear actions, useful defaults, helpful context, honest feedback, accessible states, relevant proof, fast interactions.

**Implementation rule:** if removing an element makes the screen easier to understand, remove it.

### Rule 4: Default to the user's likely need
Never make the user start from a blank state when the system can responsibly provide a useful starting point.

Apply smart defaults to: forms, filters, date ranges, search, checkout, dashboards, onboarding, settings, reports, product options, sort orders, location-based views, repeated actions.

Good: "Today" pre-selected; most popular option pre-selected; last-used location remembered; recommended plan highlighted (honestly); dashboard opening on recent activity or the next action.

**Implementation rule:** defaults benefit the user. Never use defaults to quietly trick users into upgrades, subscriptions, tracking, or commitments. (This is now also a legal risk — see Part B4.)

### Rule 5: Never start users at zero
Users continue when progress has already begun.

Use truthful progress in: onboarding, checkout, setup, profile completion, report generation, booking flows, multi-step forms, product builders, publishing flows.

Bad: "0% complete" · "You have not done anything yet"
Good: "Account created — 1 of 5 steps complete" · "Cart ready" · "Circuit started" · "Draft created"

**Implementation rule:** count real progress the user has already made. Never fake it.

### Rule 6: Give value before asking
Do not ask for signup, payment, permissions, email, personal data, or commitment before the user receives meaningful value.

Good: show partial results then offer to save the full version; let users browse/build/preview before account creation; explain a permission at the moment it becomes useful.

**Implementation rule:** the first valuable moment must happen before the first major ask.

### Rule 7: Create ownership before conversion
Users commit when they have already created, customized, selected, configured, previewed, or built something.

Bad flow: Email → password → blank dashboard
Good flow: Choose goal → customize result → preview output → save account

**Implementation rule:** account creation should feel like saving something valuable, not filling out paperwork. Warn before losing unsaved work; preserve user work across the signup boundary.

### Rule 8: Motivate honestly
Loss aversion is powerful; it must be truthful.

Good: "These 12 files are not backed up" · "This event date is not reserved yet" · "Your draft will not be saved unless you create an account" · "Your subscription ends on July 31, 2026"

Forbidden: fake countdowns, false scarcity, overstated danger, guilt-based cancellation, hidden downgrade consequences.

**Implementation rule:** show the real cost of inaction. Never manufacture fear. (Regulators now explicitly target fake urgency — Part B4.)

### Rule 9: Frame value with context
Users judge price, effort, time, and risk relatively. Never show important numbers in isolation.

- Pricing: show what's included, billing period, total cost, honest savings, comparisons that clarify.
- Effort: show estimated time, number of steps, what's complete, what's next.
- Risk: show what's protected, what's incomplete, what happens on inaction.

Bad: "$50/month"
Good: "$50/month to protect a $1,900 device" · "3-minute setup" · "2 steps remaining"

### Rule 10: Accessibility is mandatory — and now the law
Accessibility is part of the definition of done, and since June 28, 2025 the European Accessibility Act makes WCAG 2.1 AA (via EN 301 549) a legal requirement for e-commerce and consumer services touching EU users, with enforcement intensifying through 2026. Build to **WCAG 2.2 AA** as the working target so every project clears the current legal floor and the incoming EN 301 549 update. Full requirements in Part B1 and F.

**Implementation rule:** if a user cannot navigate, understand, and complete the task with assistive technology, the work is not complete — and may now be illegal to ship.

### Rule 11: Trust must be visible
Trust is created through clear interface behavior, not claims.

Make obvious: pricing, billing, renewal, cancellation, shipping, delivery, taxes, fees, returns, data collection, permissions, AI-generated content, automation, account changes, destructive actions, order status, save status, error status.

**Implementation rule:** do not make users infer anything important. The user should never feel tricked after understanding what happened.

### Rule 12: Performance is UX
A slow product is a bad product. Concrete 2026 budgets in Part B2.

**Implementation rule:** if performance suffers because of a visual effect, remove or simplify the effect. Performance regressions block release.

### Rule 13: Design for sustainability
Lighter pages, fewer scripts, less media bloat, reusable components, minimal data collection, efficient API calls, deterministic logic where AI isn't needed, durable layouts.

**Implementation rule:** a lighter interface is faster, more accessible, cheaper to maintain, and more environmentally responsible. Prefer it always.

### Rule 14: Build systems, not isolated screens
Every new interface strengthens the design system. Use reusable components, layout patterns, and tokens (Part E). Before creating a new component, check whether an existing one can be extended.

### Rule 15 (new): Calm is the aesthetic
2026's dominant design direction is calm: reduced cognitive load, disciplined motion, generous whitespace, strong typography, and the removal of visual theatrics. Attention is hyper-fragmented; the product that respects attention wins it.

Calm does not mean bland. Personality lives in typography, color voice, microcopy, and moments of considered delight — never in noise, clutter, or interruption.

**Implementation rule:** one focal point per view. If two elements fight for attention, one of them is wrong.

### Rule 16 (new): Legibility of automation
Wherever the product acts autonomously (AI agents, scheduled jobs, auto-sync, auto-pricing, auto-replies), the interface must show: what ran, when, what changed, why, and how to undo or disable it. Silent automation is a dark pattern even when well-intentioned. Full rules in Part H.

### Rule 17 (new): Design for the returning user, not just the first-timer
Most sessions are return sessions. Every product must define its "return view": what the user sees on visit 2 through 2,000. Remember state, restore context, surface what changed since last visit, and make the most frequent action one interaction away.

**Implementation rule:** first-run experience and return experience are designed separately. A product optimized only for the demo is not done.

## A3. Digital Rams Principles

Dieter Rams' ten principles remain the ethical and aesthetic foundation, translated for 2026:

**Innovative** — use new technology only when it improves the user's task. Acceptable: AI that saves time, personalization that improves relevance, motion that explains state, automation that removes repetitive work. Unacceptable: trend effects that reduce usability, AI that hides uncertainty, motion that distracts, personalization that manipulates, novel navigation that confuses. *Innovation must earn its place.*

**Useful** — clarifies the task, reduces effort, shows status, provides feedback, helps users recover, supports repeated use, solves a real problem. *A screen that does not help the user act, decide, learn, or recover should be removed or redesigned.*

**Aesthetic** — aesthetics create calm, confidence, readability, and hierarchy. Strong typography, clear spacing, balanced layout, consistent rhythm, useful contrast, appropriate motion, brand restraint. *Beauty supports use; it does not replace use.*

**Understandable** — users always know: where they are, what happened, what is happening, what they can do, what happens next, how to go back, how to fix a problem. *No tutorial required for the core interface.*

**Unobtrusive** — no excessive popups, overdesigned empty states, decorative animation, repeated promo blocks, or interruptions before value is delivered. *The UI never competes with the user's goal.*

**Honest** — no fake urgency, hidden fees, misleading defaults, confusing cancellation, disguised ads, forced continuity, bait-and-switch gating, manipulative notifications, misleading AI confidence, unclear data collection. *Persuasion is acceptable. Deception is not.*

**Long-lasting** — durable components, clear layouts, flexible systems, maintainable code, timeless typography, stable information architecture. *Prefer durable clarity over seasonal novelty.*

**Thorough down to the last detail** — design every state: default, hover, focus, active, disabled, loading, empty, error, success, warning, offline, permission-denied, no-results, partial-data, saving, saved, unsaved-changes, destructive-confirmation, and (new) AI-generating, AI-uncertain, AI-failed, agent-awaiting-approval. *A component is incomplete until all relevant states are designed and implemented.*

**Environmentally responsible** — no heavy pages, uncompressed media, wasteful scripts, unnecessary tracking, excessive polling, unnecessary AI calls, or redesign churn. *Efficiency is part of design quality.*

**As little design as possible** — *the best interface is not the emptiest one; it is the one with no unnecessary parts.*

---

# PART B — THE 2026 STANDARDS LAYER

These are the external facts every project must comply with as of July 2026. Re-verify quarterly; laws and thresholds move.

## B1. Accessibility: the legal landscape

- **The legal floor is WCAG 2.1 AA.** The European Accessibility Act has been enforced since June 28, 2025 via EN 301 549 (which incorporates WCAG 2.1 AA). Enforcement and audits are intensifying across EU member states through 2026, with penalties ranging up to €100,000 (Germany) and €1,000,000 (Spain). US: Section 508 references WCAG 2.0; ADA Title II references WCAG 2.1; DOJ web-accessibility litigation continues to treat WCAG as the de facto standard for private businesses.
- **Our working target is WCAG 2.2 AA.** The EN 301 549 update expected in 2026 incorporates WCAG 2.2. Building to 2.2 AA now (focus-not-obscured, dragging alternatives, target size 24×24 minimum, accessible authentication, consistent help, redundant entry) future-proofs every build.
- **WCAG 3.0 is a working draft** (realistic release ~2029). Track it; do not build to it; do not cite it as a compliance basis.
- **Who this hits:** any e-commerce store or consumer service reachable by EU users — which includes AHA and any client store. Treat accessibility as legal exposure, not polish.

**Practical consequences for every build:**

- Accessibility acceptance criteria are written into every feature spec (Part I).
- Automated checks (axe/Lighthouse) run in CI, but automated tools catch only ~30–40% of issues — every flow also gets a manual keyboard pass and a screen-reader pass (VoiceOver minimum, since we ship from macOS).
- An accessibility statement page ships with every EU-reachable commerce or service product.

Full implementation checklist in Part F8.

## B2. Performance: budgets, not vibes

Google's Core Web Vitals in 2026 (assessed at the 75th percentile of real visits):

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5s | 2.5–4.0s | > 4.0s |
| INP (Interaction to Next Paint) | ≤ 200ms | 200–500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 |

INP replaced FID and is the most commonly failed vital (~43% of sites fail it). It measures *every* interaction, not just the first — which means interaction responsiveness is a continuous design constraint, not a load-time one.

**LiFi NYC default performance budgets (per page, mobile, mid-tier device, 4G):**

- LCP ≤ 2.0s (stricter than Google's floor — premium sites should feel instant)
- INP ≤ 150ms on primary actions
- CLS ≤ 0.05
- JavaScript shipped to client: ≤ 150KB compressed for marketing sites; ≤ 300KB for app shells (justify anything above)
- Images: `.webp` (or AVIF where supported), explicit `width`/`height`, responsive `srcset`, lazy-load below the fold
- Fonts: max 2 families, `font-display: swap`, subset, self-hosted or preconnected
- Third-party scripts: each one is a performance/privacy line item that must be justified; load after interaction where possible
- No layout shift from ads, embeds, banners, cookie notices, or late-loading fonts

**Engineering rules for INP:**

- Break up long main-thread tasks (> 50ms); yield between chunks
- Debounce/throttle scroll and resize; use passive listeners
- Move heavy computation to web workers
- Give every interaction feedback within 100ms even if completion takes longer (optimistic UI + skeleton/progress)

**Process rule:** Lighthouse CI (or equivalent) runs on every PR and fails the build below budget. Performance regressions are release blockers.

## B3. AI transparency: now enforceable law

The EU AI Act's Article 50 transparency obligations become enforceable **August 2, 2026** (fines up to €15M or 3% of global turnover). Even for non-EU products, treat these as the global baseline because they're simply good UX:

- **Chatbots and assistants:** users must be informed they're interacting with AI, perceivable *in the interaction itself* — before or at conversation start. Burying it in ToS, a metadata watermark alone, or calling it a vague "assistant" does not comply.
- **AI-generated content:** generative output (text, images, audio, video) must be marked machine-readably and detectable as AI-generated. Public-interest text published without human editorial review must be disclosed as AI-generated. Deepfake-style content must always be disclosed.
- **Design consequence:** every AI feature we ship carries visible, honest labeling as a component-level requirement (Part H), not a legal footnote.

## B4. Deceptive design: the regulatory net is closing

- The **EU Digital Fairness Act** is being tabled Q4 2026, explicitly targeting dark patterns, addictive design, manipulative personalization, and misleading influencer marketing (application expected 2028–2030). The EU's own research found 97% of popular sites deploy at least one dark pattern — regulators consider this an epidemic, not an edge case.
- The **FTC** continues enforcement under Section 5 (unfair/deceptive practices), with particular attention to negative-option billing, obstructed cancellation, and junk fees.
- **Design consequence:** everything in our "Forbidden" lists (A2 Rule 8, Part K) is now both an ethics rule and a legal-risk rule. Cancellation must be as easy as signup. Fees appear before commitment. Consent defaults are unchecked. Urgency claims must be verifiably true.

## B5. Design tokens: a stable, portable standard exists

The Design Tokens Community Group specification reached its **first stable version (2025.10)** in October 2025. It is supported by Style Dictionary, Tokens Studio, Terrazzo, Figma, Penpot, Sketch, Framer, Supernova, zeroheight, and others.

**Design consequence:** every LiFi project's tokens are authored in (or exportable to) the DTCG format. This makes themes portable across tools, enables multi-brand/light-dark theming without file duplication, and supports modern color (OKLCH, Display P3). Details in Part E1.

## B6. The interaction landscape

Current-state patterns that inform (not dictate) our work:

- **Agentic UX:** users increasingly delegate goals rather than perform every step. Gartner projects ~40% of enterprise apps will embed task-specific AI agents by end of 2026 (from <5% in 2025). The interface layer for supervision, approval, and override is the new design frontier — Part H covers our rules.
- **Generative/adaptive UI:** interfaces assembled from modular components in response to context. We adopt the *architecture* (modular, token-driven, composable) while keeping layouts deterministic unless adaptivity demonstrably helps the task.
- **Calm interfaces:** the market has turned against visual theatrics. Transparency, disciplined motion, and reduced cognitive load are the differentiators. This matches our doctrine; we were early.
- **Multimodal input:** voice, camera, and paste-anything inputs are normalizing. Where relevant (search, support, data entry), accept more input types — but always with a plain manual fallback.
- **Express payment dominance:** Apple Pay / Google Pay / Shop Pay now account for over half of mobile e-commerce transactions. Checkout playbook in Part D2 treats wallets as primary, not optional.

---

# PART C — UX PSYCHOLOGY IMPLEMENTATION RULES

Persuasion mechanics, used honestly. Every technique below has a bright line: it must survive the user fully understanding how it works. If the technique only works while hidden, it's a dark pattern — don't ship it.

## C1. Smart defaults
Reduce decisions. Apply to forms, search, filters, dashboards, checkout, settings, onboarding, product builders, booking flows.

Rules: preselect the most common useful option; use safe defaults; let users change them easily; never hide important choices; never use defaults to trick.

## C2. Goal-gradient effect
Show progress early. Never show 0% when real progress exists. Count completed setup actions. Show steps remaining and a finish line. Keep progress truthful.

## C3. Reciprocity
Give before asking. Show useful value before gating; ask users to save after value is delivered; never blur or lock everything after the user has invested effort; make free value genuinely useful.

## C4. IKEA / endowment effect
Let users build before committing. Let users create or customize first; make signup feel like saving progress; preserve user work; warn before losing unsaved work.

## C5. Loss aversion
Show real consequences of inaction. Be specific, truthful, proportionate. Never exaggerate, never fake urgency, always let users decline without shame.

## C6. Contrast effect
Frame costs relative to useful context. Avoid isolated prices; show what the cost protects, unlocks, saves, or includes; use honest plan comparisons; show total cost clearly; never obscure the cheaper option.

## C7. Peak-end rule (new)
Users remember the emotional peak and the ending of an experience. Invest craft in: the moment of first value ("aha"), successful completion states (order placed, site published, booking confirmed), and graceful exits (cancellation, offboarding, refunds). A generous cancellation flow creates more long-term revenue than an obstructed one — and an obstructed one is now a legal risk.

## C8. Recognition over recall (new)
Never make users remember what the system already knows. Show recent items, remembered preferences, previously used addresses/payment methods (with consent), and context from prior sessions. Every "re-enter this information" moment is a defect. (WCAG 2.2's redundant-entry criterion makes this an accessibility requirement too.)

## C9. Cognitive load budget (new)
Every screen has a decision budget: aim for one primary decision per view, no more than 3–4 simultaneous choices per step in flows. Chunk long forms. Use progressive disclosure for advanced options. Density is fine for expert tools (see D4) — but density must be *organized*, not merely crowded.

## C10. Fitts's law & the thumb (new)
Primary actions on mobile live in the thumb zone (bottom half of screen). Touch targets ≥ 44×44px (WCAG 2.2 minimum is 24×24; our floor is 44). Destructive actions are never adjacent to primary actions. Sticky primary CTAs are appropriate on long commerce and booking pages.

---

# PART D — PROJECT-TYPE PLAYBOOKS

The doctrine is universal; its expression adapts per archetype. Every project starts by classifying itself, then applies its playbook *on top of* Parts A–C and E–K.

## D0. Classification framework

Answer these seven questions at kickoff. They determine the playbook mix, information architecture, and system priorities:

1. **Primary user relationship:** visitor (anonymous, low-frequency) → customer (transactional) → operator (daily tool) → participant (multi-sided network)?
2. **Session shape:** single-visit conversion, repeat purchase, daily workflow, or continuous monitoring?
3. **Core object:** what noun does the product manage? (page, product, order, project, venue, route, booking, report…) The core object's lifecycle drives the IA.
4. **Trust stakes:** what is the user risking? (time, money, reputation, business operations, legal compliance) Higher stakes → more confirmation, audit, and undo surface.
5. **Density need:** consumer-calm (low density) or operator-dense (high density, keyboard-first)?
6. **Automation surface:** what will the system do without a human click? Every automated behavior needs Part H treatment.
7. **Tenancy & roles:** single user, team, or multi-organization? Roles determine navigation, permissions UI, and empty states.

Hybrid products (most real ones) combine playbooks per surface: e.g., VenueCircuit is a Platform (D5) whose venue-owner side is an Operator Cockpit (D4) and whose public venue pages are Marketing Site (D1).

---

## D1. Playbook: Marketing / Local Business Site
*(LiFi core business — restaurants, trades, studios, professional services)*

**Job of the product:** convert a searcher into a contact, booking, order, or visit — usually in under 90 seconds, usually on a phone, often mid-task in the real world.

**Primary tasks (rank at kickoff):** call, book, get directions, view menu/services/pricing, check hours, send inquiry, order.

**Rules:**

- The top of the mobile viewport answers: who this is, where, and the #1 action (call/book) — before any scroll.
- NAP (name, address, phone) consistent everywhere; phone numbers are `tel:` links; addresses link to maps.
- Hours are structured data (schema.org LocalBusiness) and visibly current — "Open now · closes 10pm" beats a static table.
- One primary CTA per page, persistent on mobile (sticky bar acceptable).
- Proof near the ask: reviews, photos of real work, credentials — adjacent to the CTA, not on a separate page.
- Menus/services/pricing as real HTML, never PDF-only, never image-only. If pricing matters to the decision, show it.
- Contact forms: minimum fields (name, contact method, message); confirm receipt with expected response time.
- Local SEO is a design requirement: semantic headings, structured data, per-location pages if multi-location, fast LCP (hero image is usually the LCP element — optimize it first).
- Zero popups before value. Email capture, if any, comes after content is consumed.
- The footer carries "Designed, Hosted and Cared For by LittleFightNYC.com" in brand orange.

**Success metrics:** calls/bookings/direction-taps per visit; LCP ≤ 2.0s; zero mystery-meat navigation; owner can verify their own info is current.

**Failure smells:** hero carousels, autoplay video with sound, "Welcome to our website" copy, stock photos of handshakes, PDF menus, contact pages that hide the phone number.

---

## D2. Playbook: E-Commerce / DTC Store
*(After Hours Agenda and client stores)*

**Job of the product:** let a shopper find, evaluate, and buy with zero avoidable friction, then come back.

**The 2026 baseline facts (Baymard-derived):** average checkouts carry ~15 form fields when 6–8 suffice; checkout redesign alone can lift conversion ~35%; a majority of mobile checkout abandonment is caused by process friction, not purchase intent; express wallets are now the majority of mobile transactions.

**Product discovery:**

- Default listing = best sellers or curated relevance, never "newest" unless drops are the model.
- Filters match how shoppers think (size, color, price, availability) with counts, instant apply, and easy reset.
- Search tolerates typos, suggests as-you-type, and has a designed no-results state with recovery paths.
- Product cards: real product image, name, price, availability signal. Hover/secondary image on desktop. No cards without prices.

**Product detail page (PDP):**

- Above the fold (mobile): image, name, price, variant selector, Add to cart.
- Every image zoomable; show the product worn/in-context AND flat/detail; size guides one tap away, size-specific stock shown on the selector (disable ≠ hide: show "XL — out of stock, notify me").
- Shipping cost and delivery estimate ON the PDP — not discovered at checkout. Surprise shipping is the #1 abandonment cause.
- Returns policy summarized in one sentence near Add to cart, linked to detail.
- Reviews with distribution, photos where available; never fabricate.
- Add-to-cart gives immediate feedback (mini-cart drawer or clear confirmation) with paths both to checkout and continue shopping.

**Cart:**

- Editable in place (quantity, variant, remove) without page reloads.
- Line-item clarity: image, name, variant, unit price, line total.
- Full cost honesty: subtotal + shipping estimate + tax estimate before checkout begins.
- Express checkout (Apple Pay / Google Pay / Shop Pay) at the top of the cart, clearly labeled.
- Free-shipping progress if a threshold exists ("$12 away from free shipping") — honest and useful.
- Cart persists across sessions and devices where identity allows.

**Checkout (the money surface — over-invest here):**

- Guest checkout is the most prominent path. Account creation is offered AFTER purchase ("Save your info for next time") — that's the ownership moment.
- Wallets first on mobile: Apple Pay/Google Pay at the very top; a wallet user should complete checkout in two taps.
- 6–8 visible fields max: email → shipping address (with autocomplete) → shipping method → payment. Billing = shipping by default.
- Single-page checkout for typical DTC carts (low complexity, mobile-heavy, 1–3 items); multi-step with a truthful progress indicator only when complexity requires it.
- Inline validation on blur, errors tied to fields, never clear entered data on error.
- The pay button states the total: "Pay $48.20".
- Order review shows everything: items, address, method, costs, total — with edit links per section.
- Trust cues at the payment step: security signals, accepted payment methods, returns link, support path.
- No surprise costs after the cart. Ever. This is doctrine AND regulation.

**Post-purchase:**

- Confirmation page + email with order number, item summary, delivery estimate, and support path.
- Order status page (guest-accessible via link): placed → processing → shipped (tracking) → delivered.
- Returns initiated self-serve; the generosity of returns UX is a retention investment (peak-end rule).
- For print-on-demand (Printful-style) fulfillment: set delivery expectations honestly at PDP and checkout — production time + shipping time, not just shipping.

**Commerce-specific states:** out-of-stock (notify-me), low-stock (only if literally true), back-in-stock, pre-order (with date), sale (with honest reference price), discontinued (redirect to nearest alternative).

**Success metrics:** checkout completion rate, cart abandonment, mobile conversion, INP on variant-selection and add-to-cart interactions, support tickets about "where is my order" (should trend to zero — status UX absorbs them).

**Failure smells:** forced account creation, fees revealed at step 3, fake countdown timers, newsletter modal on first pageview, "Continue" as the pay button, PDPs without shipping info.

---

## D3. Playbook: SaaS Product

**Job of the product:** get a new user to first value fast, make the core workflow effortless at frequency, and make the value visible enough to justify renewal.

**The 2026 baseline facts:** median activation rate is ~37.5%; nearly two of three B2B signups never reach first value; top-quartile products deliver first value inside 1–7 days (top-decile: 1–3); contextual guidance has replaced forced product tours as the effective onboarding pattern.

**Onboarding & activation:**

- Define the activation event precisely (the action that correlates with retention — e.g., "published first page," "ran first report," "invited a teammate"). Everything in onboarding drives toward it.
- Preferred flow: goal → preference → useful preview → setup progress → save/continue. Never: signup → long survey → empty dashboard.
- Ask only what's needed to personalize the first result; every additional signup field must justify itself.
- Onboarding checklist (3–5 items) with real progress pre-counted ("1 of 5 done — account created"). Checklists close open loops; keep them visible but dismissible.
- Contextual guidance at the moment of need beats linear tours. Limit choices to 3–4 per step.
- Templates, sample data, or an AI-drafted starting point so the workspace is never blank. "Start from example" is an activation feature, not a nicety.
- Instrument every step; find the single biggest drop-off; fix it; repeat.

**The working product:**

- The return view (Rule 17) shows: what needs attention, what changed since last visit, and the next best action — within one screen.
- The core loop must be fast at frequency: keyboard shortcuts for operators, bulk actions, saved views/filters, command palette (⌘K) for products with >8 nav destinations.
- Autosave by default; visible save state ("Saving… / Saved / Unsaved changes"); undo over confirmation wherever reversible.
- Collaboration surfaces (if multi-user): presence, comments, activity log, and permission clarity ("who can see this?" answered in the UI).

**Pricing, billing, and the renewal relationship:**

- Plan pages: clear names, clear billing period (monthly vs annual visible simultaneously), total cost, honest recommended plan, feature differences that matter (not 40-row checkmark theater), trial terms, renewal terms, cancellation terms.
- Usage-based elements show current usage and projected cost BEFORE the invoice surprises anyone.
- Upgrade prompts appear at the moment of hitting real value/limits — contextual, honest, dismissible. Never nag-loops.
- Downgrade and cancellation are self-serve, as easy as signup, with an honest statement of what's lost and when. Offer a pause where it fits. (FTC negative-option scrutiny applies.)
- Dunning (failed payment) flows are specific and kind: "Payment failed. Update your card to keep this workspace active" with grace-period clarity.

**Lifecycle states to design:** trial (days remaining, honestly), trial-expired (data preserved, path back), payment-failed (grace period), plan-limit-reached (clear options), churned-but-returning (welcome back with their work intact).

**Success metrics:** activation rate, time-to-value, week-4 retention of activated users, expansion vs churn, support contact rate per active user.

**Failure smells:** blank dashboard after signup, 10-field signup forms, forced tour modals, hidden cancellation, "contact sales" as the only pricing information for a self-serve product, feature gates the UI doesn't explain.

---

## D4. Playbook: Specialized Operator Tool / Cockpit
*(Public House Creative Cockpit class: a dense, daily-driver tool for one operator or a small team running a real business)*

**Job of the product:** compress a professional's recurring workflow — status at a glance, act fast, trust it completely. This is a tool someone lives in; optimize for the 500th session, not the demo.

**Cockpit rules:**

- **The glance test:** within 5 seconds of opening, the operator knows: is everything OK? what needs me? what changed? Lead with exceptions and required actions, not vanity aggregates. A metric without a decision attached is decoration.
- **Density is a feature here** — but organized density: consistent alignment grids, tabular numerals for scanning, status color + icon + label (never color alone), and progressive disclosure into detail. Offer comfortable/compact density modes.
- **Keyboard-first:** every frequent action has a shortcut; command palette; focus management that never traps or loses the operator; bulk selection and bulk action on every list.
- **Speed is trust:** operators feel every 100ms. Optimistic UI for common mutations with visible rollback on failure; skeletons over spinners; local caching of reference data.
- **Real-time honestly:** show data freshness ("Updated 12s ago"); if live, degrade visibly when the connection drops (offline banner + queued actions), never silently.
- **Undo culture:** operators move fast and make mistakes. Undo for every reversible action (toast with Undo, 5–10s); typed confirmation only for the truly irreversible; an activity log answering "what happened while I was out" — especially for multi-person teams and automated jobs.
- **Workflow, not features:** map the operator's actual day (open → triage → act → reconcile → close) and make each stage one surface. Navigation mirrors the workflow, not the database schema.
- **Saved views are the product:** operators build their own lenses (filters + sort + columns persisted and shareable). The default view is opinionated; customization is remembered.
- **Integrations status:** cockpits aggregate other systems (POS, calendar, socials, booking engines). Every integration shows connection health, last sync, and a re-auth path *in context* — a broken silent integration is a catastrophic trust failure.
- **Automation with a leash:** anything the cockpit does automatically (auto-post, auto-reply, auto-reorder) follows Part H: preview before first run, activity log always, easy pause, per-automation on/off.

**Success metrics:** time-to-complete for the top 3 recurring tasks, daily return rate, actions per session trending efficient, "I checked somewhere else to verify" incidents → zero.

**Failure smells:** dashboards of charts nobody acts on, mouse-only interactions, spinners on every click, sync states the user can't see, settings buried five levels deep for daily-adjusted values.

---

## D5. Playbook: Multi-Sided Platform / Marketplace
*(VenueCircuit.app class: venues, artists/bookers, and routing/booking workflows in one network)*

**Job of the product:** create trust and liquidity between parties who don't know each other, and make the coordination workflow (search → evaluate → book → execute → review) dramatically easier than email and spreadsheets.

**Platform rules:**

- **Each side gets its own product.** Supply (venue owners) and demand (artists/bookers/organizers) have different jobs, vocabularies, dashboards, and onboarding. Design them separately; never make one side use the other's interface. Shared object pages (a venue, a booking, a route) render role-appropriate views of the same truth.
- **Solve the empty-network problem by being useful single-player first.** A booker should get value from browsing and building a route before anyone responds; a venue should get a great profile page and calendar tool even with zero inbound. Ownership-before-conversion (Rule 7) is the cold-start strategy.
- **Profiles are trust documents:** completeness meters (honest), verification badges (with visible criteria), real photos, response time/rate, reviews from completed transactions only. Never fake activity, never seed fake reviews.
- **Search is the demand-side product:** structured filters that match real decision criteria (capacity, date availability, location/radius, genre/fit, tech specs, price band); map + list duality; designed no-results recovery ("No venues match 500 capacity on Friday. Try lowering capacity, changing date, or clearing filters."); saved searches and alerts.
- **Availability must be trustworthy:** a calendar that's wrong is worse than none. Design for the reality that supply-side calendars go stale — freshness signals, "updated X ago," easy owner tools to maintain, and request-flows that tolerate staleness gracefully.
- **The transaction flow is a negotiation, not a cart.** Inquiry → response → terms → hold/confirm → execute → settle. Every stage: visible status for both parties, expected-response expectations, in-thread context (dates, terms, money live in the thread, not scattered), and state changes that notify the other side. Ambiguity about "where are we in this deal" kills platforms.
- **The route/circuit builder is the magic surface** (VenueCircuit-specific but generalizable): let users assemble multi-stop plans with drag-and-drop AND accessible alternatives (WCAG 2.2 dragging-alternative), auto-checked feasibility (distances, dates, conflicts), and shareable output. This is the IKEA-effect engine — a half-built circuit is the reason to create an account.
- **Messaging with guardrails:** structured requests over blank text boxes where possible (date, size, budget prompts); anti-disintermediation handled by making the platform genuinely more useful for the transaction (contracts, payments, history), not by punitive contact-blocking.
- **Payments & escrow-ish flows:** deposits, holds, cancellation policies per listing shown BEFORE commitment; payout clarity for supply side (when, how much, minus what fees — itemized); disputes with a designed process, not an email address.
- **Reputation both ways:** double-blind reviews after completion, structured + freetext, disputable through a visible process.
- **Network health is an admin product:** the platform team needs its own cockpit (D4) for moderation, verification queues, dispute handling, and liquidity monitoring — budget for it from day one.

**Success metrics:** time-to-first-response, inquiry→booking conversion, calendar freshness, repeat usage per side, disintermediation rate trending down because the platform is *better*, not because it's punitive.

**Failure smells:** one dashboard trying to serve both sides, stale availability with no signal, deal state living in unstructured chat, fees revealed at payout, reviews from non-transactions, cold-start UX that's just an empty search page.

---

## D6. Playbook: Content / Editorial / Community surfaces
*(Blogs, lookbooks, drops content for AHA, docs, help centers — usually a layer within another archetype)*

- Reading experience first: 60–75ch measure, 16px+ body, generous line height, real typographic hierarchy.
- Content answers a question or serves a decision; every article ends with a next action relevant to its content.
- Help centers: search-first, task-titled articles ("Change your shipping address"), honest freshness dates, escalation path to a human always visible.
- AI-assisted content follows B3/H labeling rules when unreviewed; edited-by-humans content credits humans.
- No infinite-scroll traps on task-adjacent surfaces; no autoplay; no interstitials before content.

---

# PART E — SYSTEM ARCHITECTURE

## E1. Design tokens (DTCG format)

All tokens authored in or exportable to the DTCG stable spec (2025.10). Three tiers:

1. **Primitive tokens:** raw values — the palette, the type scale, the spacing scale. Named by what they are (`orange-500`, `space-4`), never by use.
2. **Semantic tokens:** meaning — `color.bg.surface`, `color.text.muted`, `color.action.primary`, `color.status.danger`, `space.stack.md`, `radius.interactive`. Components consume ONLY semantic tokens.
3. **Component tokens (as needed):** `button.primary.bg`, `card.padding` — alias semantic tokens; exist to make theming precise.

**Token categories every project defines:** color, typography (family, size, weight, line-height, letter-spacing), spacing, radius, borders, shadows/elevation, motion (durations, easings), z-index scale, breakpoints, opacity, component states.

**Rules:**

- No hard-coded values in components. A hex code in a component file is a defect.
- Theming (light/dark, client brands, white-label) happens by swapping semantic-token values — never by forking components. This is how one system serves every LiFi client.
- Use OKLCH for color manipulation (perceptually uniform lightness makes accessible palette generation systematic); ship with sRGB fallbacks.
- Dark mode is a first-class theme where the product is used in the dark (cockpits, nightlife-adjacent products like VenueCircuit) — not an inverted afterthought. Respect `prefers-color-scheme`, allow manual override, persist the choice.
- Every semantic color pair (text-on-bg) is contrast-verified at token level: ≥4.5:1 body text, ≥3:1 large text and UI components. Verify in BOTH themes.

## E2. Component system

Minimum component inventory: Button, Input, Select, Checkbox, Radio, Toggle, Textarea, Card, Modal, Drawer, Table, Tabs, Badge, Alert, Toast, Tooltip, Progress, Skeleton, Breadcrumb, Navigation (top/side/mobile), Pagination, Avatar, Empty state, Error state, Loading state, Search input, Date picker, File upload, Stepper, Command palette (for D3/D4), Stat/KPI block (with action), Timeline/Activity feed, Message thread (for D5), Calendar/Availability (for D5).

**Every component defines, before it is "done":**

- All relevant states: default, hover, focus, active, disabled (with explanation affordance), loading, error, empty, success, readonly
- Keyboard behavior and focus management
- Screen-reader semantics (roles, names, announcements)
- Responsive behavior at every breakpoint
- Density variants where the archetype needs them (D4)
- Motion behavior + reduced-motion behavior
- Token consumption (zero hard-coded values)
- Content guidelines (label length, truncation, localization stretch ~30%)

**Rule:** no component is complete until its *behavior* is defined, not just its appearance. Before building a new component, check whether an existing one extends.

### E2.1 Per-component behavior rules

**Buttons:** one primary action per section; CTA describes result; disabled states explain why (tooltip or inline text); loading state prevents duplicate submission; visible focus; ≥44px target. Hierarchy: primary (main action) → secondary (alternative) → tertiary (low emphasis) → destructive (delete/cancel/remove, always confirmed or undoable).

**Cards:** represent one coherent object or action (product, order, venue, event, task, alert, report, metric-with-action, profile, content item). Clear title, status where relevant, metadata, one primary action or whole-card click target with accessible semantics. No decorative cards that don't help the user decide or act.

**Navigation:** clear labels; current location visible; predictable grouping; mobile behavior defined; keyboard accessible; no hidden critical actions; no clever names for core sections. Must answer: Where am I? Where can I go? What section am I in? How do I get back?

**Modals:** only for focused decisions or blocking interruptions — confirm destructive action, complete a short focused task, show critical information, resolve a blocking issue. Never for long forms, announcements, or marketing. Requirements: focus trap, Escape closes, visible close, clear title, clear action, return focus on close, safe on small screens. Prefer drawers or pages for anything longer than a decision.

**Tables:** for comparison, management, and dense structured data. Clear column names; sort/filter/search where useful; row actions; empty/loading states; responsive strategy chosen per table (cards, column priority, or intentional scroll); keyboard support; status as label+icon, not color alone; tabular numerals for numeric columns.

**Alerts & toasts:** types info/success/warning/error/critical, used truthfully by severity. Clear message + action if needed + dismiss where appropriate; never color-only; toasts are transient confirmations only and never carry must-retain information.
Bad: "Warning." Good: "Payment failed. Update your card to keep this order active."

**Progress indicators:** truthful always. Show current step, completed steps, remaining steps; no fake precision; indeterminate loading only for genuinely unknown durations.

**Inputs:** visible label; help text where needed; error text tied to field; success state where useful; required/optional indicated; autocomplete attributes; correct input type and mobile keyboard; keyboard accessible.

## E3. Motion system

Motion exists to explain state change, preserve context, and confirm action — never to decorate.

- Durations: micro-interactions 100–150ms; standard transitions 150–300ms; complex/spatial 300–400ms max. Nothing UI-blocking beyond 400ms.
- Easings: standard ease-out for entrances, ease-in for exits, defined as motion tokens.
- Every animation answers "what does this explain?" — where something came from, where it went, what changed, or that input was received.
- `prefers-reduced-motion`: all non-essential motion collapses to instant transitions or simple fades. This is implemented, not aspirational.
- Animate `transform` and `opacity` only (compositor-friendly); never animate layout properties on interaction paths (INP budget).
- Skeletons pulse subtly; spinners are a last resort; progress bars for anything with known duration.

## E4. Layout & responsive rules

- Mobile-first layout logic. Responsive design restructures around device context; it never merely shrinks desktop.
- Defined breakpoints as tokens; test at each plus one "awkward middle" width.
- Touch targets ≥44×44px; primary mobile actions in thumb reach; no hover-dependent functionality (hover enhances, never gates).
- Tables on mobile: transform to cards, prioritize columns, or scroll intentionally with sticky headers/first column — chosen per table, not defaulted.
- No horizontal scroll unless intentional (galleries, kanban). No layout shift (CLS budget): reserve space for images, embeds, banners, and async content.
- Safe-area insets respected (notches, home indicators); modals and drawers usable on small screens with reachable close targets.
- Container queries preferred over viewport queries for reusable components — components adapt to their container, which is what makes them truly reusable.

## E5. Notifications & communication surfaces

Every product defines its notification doctrine:

- **In-product:** toasts for transient confirmations (with Undo where reversible); inline alerts for contextual state; a notification center for anything the user may need later. Toasts never carry information the user must retain.
- **Email/push:** each notification type individually controllable; defaults respectful; transactional vs promotional clearly separated (and legally separated); every promotional message has one-tap unsubscribe.
- **Urgency honesty:** severity levels used truthfully. If everything is urgent, nothing is. Critical = data loss, money, security. Everything else queues politely.

---

# PART F — PAGE & FLOW RULES

## F1. Homepage / landing page

Must answer: What is this? Who is it for? What problem does it solve? What can I do first? Why should I trust it?

Requirements: clear headline (specific, not visionary), clear subheadline, one primary CTA, optional secondary CTA, proof/credibility, fast load (hero is usually LCP — optimize first), mobile-first, no premature popups, no hidden pricing when pricing is central to the decision.

Bad headline: "Experience the future of connected possibilities."
Good headline: "Build and manage venue routes for live events in minutes."

## F2. Dashboard

Must answer: What needs attention? What changed? What is healthy? What is at risk? What should I do next?

Requirements: useful default view, no dead blank state, prioritized alerts, status labels, recent activity, a primary action, filters with smart defaults, designed empty/loading/error states, responsive layout. No decorative metrics — every number supports a decision or leaves.

## F3. Forms

- Visible labels always (placeholder-only labels are forbidden), clear purpose per field, smart defaults, inline validation on blur, helpful error messages tied to fields, required/optional marked, logical grouping, minimal fields, correct input types and mobile keyboards, autocomplete attributes, keyboard support, clear submission result.
- Never: disable submit without explanation, ask for unneeded data, show "Invalid input," clear entered data after an error, or force re-entry of known data (WCAG 2.2 redundant entry).
- Good error: "Enter a valid email address, like name@example.com."
- Multi-step forms: truthful progress, back-navigation preserves data, save-and-resume for anything over ~3 minutes.

## F4. Onboarding

Start with value, not paperwork. Ask only what's needed. Show truthful progress. Smart defaults. Skippable nonessentials. Useful first result fast. No long intro carousels. Preferred flow: goal → preference → useful preview → setup progress → save/continue. (Full SaaS treatment in D3.)

## F5. Checkout / payment flows

Clear cart, price, taxes, fees, delivery, payment step, confirmation; truthful progress; edit paths; error recovery; trust cues; mobile-first. Never hide fees, add late surprise costs, obscure cancellation/returns, or force account creation where guest flow suffices. Pay button states the total. (Full commerce treatment in D2; applies to bookings and subscriptions too.)

## F6. Search & filtering

Useful default results, clear filters with counts, easy reset, sort options, typo tolerance, suggestions, recent searches where useful, responsive performance.

No-results states include: what was searched, why nothing matched if known, suggested next actions, clear reset.
Bad: "No results."
Good: "No venues match 500 capacity on Friday. Try lowering capacity, changing date, or clearing filters."

## F7. The state catalog (every surface)

**Empty states:** what is empty + why it matters + what to do next + one primary action + optional sample/example.
Good: "No orders yet. When customers place orders, they'll appear here. Create a test order to preview the workflow."

**Loading states:** skeletons for content, progress for multi-step generation, specific messages ("Generating your report — usually under a minute"), timeout handling, retry paths. Feedback within 100ms of any interaction.

**Error states:** plain-language what-happened + whether user data is safe + how to recover + retry + support path.
Good: "We couldn't save your changes because the connection was interrupted. Your edits are still on this page. Try saving again."

**Success states:** what happened + confirmation details + next best action + reference/receipt where useful.
Good: "Order placed. Confirmation #1842 was sent to your email. Track order status."

**Offline states (new, required for D4/D5 and mobile-heavy products):** visible connection status, queued-action clarity ("3 changes will sync when you're back online"), no silent data loss, graceful reconnect.

**Permission-denied states:** explain what's restricted, why, and who/how to request access — never a bare 403.

## F8. Accessibility implementation checklist (WCAG 2.2 AA working target)

Structure & semantics: semantic HTML first, ARIA only when native HTML is insufficient; correct heading hierarchy; descriptive page titles and link text; landmarks; skip links on nav-heavy pages.

Keyboard: complete every flow keyboard-only; visible focus states everywhere (and focus not obscured by sticky elements — 2.2); logical focus order; focus managed on route changes, modal open/close, and dynamic content; no traps.

Screen readers: labels on all inputs; errors programmatically associated and announced; live regions for async updates (toasts, validation, chat); status not conveyed by color alone; icons with accessible names or properly hidden.

Interaction: touch targets ≥44px (2.2 floor 24px); drag interactions have single-pointer alternatives (2.2); no hover-only or motion-only functionality; accessible authentication — no cognitive puzzles, allow paste in password fields, support password managers (2.2).

Content: contrast ≥4.5:1 / ≥3:1 verified at token level in all themes; text resizable to 200% without loss; reduced-motion respected; help available consistently across pages (2.2); no redundant entry (2.2).

Process: axe/Lighthouse in CI + manual keyboard pass + VoiceOver pass per flow; accessibility items in every feature spec; accessibility statement page on EU-reachable commerce/services.

---

# PART G — CONTENT & VOICE

## G1. Voice
Clear, direct, useful, calm, honest, specific, non-manipulative. Avoid hype, guilt, shame, fake urgency, vague abstractions, overpromising, and cute language in serious flows (payments, errors, security, cancellations — no jokes when money or work is at risk).

Brand personality (AHA's edge, a client's warmth) lives in marketing surfaces, empty-state flavor, and success moments — never at the cost of task clarity, and never in error or billing flows.

## G2. Writing formulas

- **CTA:** verb + object/result. "Save report" · "Place order" · "Track shipment" · "Add venue" · "Send inquiry" · "Publish page". Use "Continue" only when the next step is unambiguous from context.
- **Error:** what happened + why (if known) + how to fix. "We couldn't process the payment because the card was declined. Use a different payment method or contact your bank."
- **Empty state:** what's empty + why + next action. "No saved venues yet. Add venues to build your first circuit."
- **Confirmation:** what happened + details + next action. "Your order was placed. Confirmation #1842 was sent to your email."
- **Permission ask:** what we need + why now + what happens if declined. "Allow location access to find venues near you. You can also search by city."
- **AI disclosure:** what the AI did + what it used + what to check. "This description was drafted by AI from your venue details. Review before publishing."

## G3. Microcopy standards
Numbers formatted for humans (1,204 not 1204; "2 min read"); dates unambiguous ("Jul 8, 2026", relative "2 hours ago" with absolute on hover/tap); timezones explicit wherever scheduling crosses them (critical for D5); currency always with symbol and, where international, code; plurals handled ("1 item", "2 items" — never "1 item(s)").

---

# PART H — AI-NATIVE INTERFACE RULES

Applies whenever a product includes AI generation, recommendation, automation, chat, summarization, classification, agents, or decision support. These rules implement both good UX and EU AI Act Article 50 (enforceable August 2, 2026 — see B3).

## H1. The trust contract

AI should feel like a capable assistant, not a mysterious authority. Users grant autonomy only to systems they understand. Explainability is a core design material, not a compliance checkbox: surface what was inferred, why an action was suggested/taken, what data was used, and how confident the system is — in human language.

## H2. Disclosure & labeling (legal floor + house style)

- Conversational AI identifies itself as AI before or at conversation start, perceivable in the interaction itself — not in ToS, not via a vague "assistant" persona.
- AI-generated output is visibly labeled at the point of display AND machine-readably marked where the output is content (text, images, audio, video).
- Unreviewed AI text published to inform the public is disclosed as AI-generated; human-reviewed content may carry editorial credit instead.
- Confidence is expressed honestly. Never present a guess with the typography of a fact. "Likely" / "Draft" / "Estimated" are interface words now.

## H3. The generate → review → commit pattern (default for all AI output)

1. **Generate:** show specific progress ("Drafting your venue description…"), allow cancel, keep the surrounding UI responsive.
2. **Review:** output arrives editable, labeled, with source/context where accuracy matters, and with regenerate + refine controls.
3. **Commit:** the user explicitly applies/publishes/sends. AI never makes irreversible changes without approval.

Provide undo even after commit wherever technically possible.

## H4. Agentic UX (delegated execution)

When the system executes multi-step tasks on the user's behalf:

- **Preview before first run:** show the plan (what it will do, to what, roughly in what order) before an agent's first execution of any new automation.
- **Approval gates at consequence:** anything involving money, external communication (emails, posts, messages to other parties), destructive changes, or legal commitments requires explicit approval — per action or via an explicit, scoped, revocable standing permission ("Always allow posting scheduled content ≤ $0 cost").
- **Live status:** while running — what step it's on, what it has done so far, pause/stop always available.
- **Receipts:** after running — an activity log entry: what ran, when, what changed, why (trigger), with links to results and undo where possible. This log is a first-class surface, not a debug view.
- **Interruption & handoff:** when the agent is uncertain or blocked, it asks a specific question with context — never fails silently, never guesses on high-stakes branches.
- **Kill switch:** every automation individually pausable; a global "pause all automations" exists for operator products.

## H5. Boundaries

AI should: assist, draft, summarize, recommend, accelerate, explain, organize.
AI should not: impersonate certainty, act irreversibly without approval, hide reasoning sources where accuracy matters, replace user control, obscure responsibility, or be used where simple deterministic logic is better (use a date-diff, not a model, to compute days-until-event).

Every AI feature ships with a non-AI fallback path: the form still submits, the search still searches, the description can still be written by hand.

## H6. AI-specific states

Add to the state catalog wherever AI exists: generating (with cancel), streaming, low-confidence (visually distinct), failed-generation (with retry + manual path), agent-running, agent-paused, agent-awaiting-approval, agent-completed (receipt), model-unavailable (graceful degradation to manual).

---

# PART I — PROCESS

## I1. Implementation order (any project, feature, page, or flow)

1. Classify the project/surface (D0) and read the relevant playbook(s)
2. Define the user goal
3. Define the business goal
4. Define the primary action
5. Define the required information and data
6. Define the user flow (including return-visit flow — Rule 17)
7. Define smart defaults
8. Define progress states
9. Define empty/loading/error/success/offline states (F7) and AI states if applicable (H6)
10. Define accessibility requirements (F8)
11. Define performance budgets (B2)
12. Define automation/AI surfaces and their approval model (Part H)
13. Build reusable components (tokens first — E1)
14. Build the page or flow
15. Test the primary task
16. Test accessibility (automated + keyboard + screen reader)
17. Test mobile and awkward viewport widths
18. Test edge cases and every state
19. Remove unnecessary UI
20. Finalize copy against Part G
21. Verify against acceptance criteria (I3)

Never start by decorating the screen.

## I2. Feature spec template

```
## Feature name
## Project archetype(s) [D0 classification]
## User goal
## Business goal
## Primary action
## Secondary actions
## Required screens/components (routes, views, components — reuse check done?)
## Data required
## Smart defaults
## Progress indicators
## Value-before-ask (what value precedes signup/payment/permission/data asks?)
## Ownership moment (what does the user create/customize/preview/configure?)
## Honest motivation (what real consequence of inaction is shown?)
## Value framing (how are price/effort/risk/time contextualized?)
## Return-visit behavior (what does visit N look like?)
## States: empty / loading / error / success / offline / partial
## AI & automation surface (labeling, approval gates, receipts, fallback — Part H)
## Accessibility requirements (keyboard, SR, contrast, focus, motion, touch — F8)
## Performance requirements (budgets, assets, scripts, API behavior — B2)
## Notifications emitted (type, channel, urgency honesty — E5)
## Acceptance criteria (specific pass/fail)
```

## I3. Acceptance criteria for any screen

A screen is not complete unless ALL are true:

- Purpose understandable within 5 seconds
- Primary action clear; next step clear
- Useful default state; no unnecessary decorative elements
- Empty, loading, error states designed; success state designed where relevant; offline behavior defined where relevant
- Mobile layout works (not a crushed desktop); keyboard navigation works; focus states visible; touch targets ≥44px
- Form fields have visible labels; errors explain recovery
- Pricing/commitments clear; data requests explained
- Performance within budget (LCP ≤2.5s / INP ≤200ms / CLS ≤0.1 minimum; LiFi budgets preferred)
- No color-only meaning; reduced motion respected
- No fake urgency, deceptive defaults, or any Part K violation
- AI output labeled, editable, approvable; automations logged and pausable (where applicable)
- Components consume system tokens; no hard-coded style values
- Return visit shows remembered context where the product has any
- Supports the user goal and the business goal without manipulation

## I4. QA gates (release blockers)

1. **Task gate:** primary task completes on a real phone, on throttled 4G, by someone who didn't build it.
2. **Accessibility gate:** automated scan clean + keyboard-only completion + screen-reader pass of the flow.
3. **Performance gate:** CI budget check green; no regression vs. previous release.
4. **State gate:** every state in the spec exists and was seen with human eyes (force error/empty/offline in testing).
5. **Honesty gate:** a reviewer reads every price, claim, default, timer, and cancellation path asking "would a user feel tricked after understanding this?" Any yes blocks release.
6. **Copy gate:** every CTA, error, and empty state checked against Part G formulas.

## I5. Post-launch

- Instrument the primary task funnel and activation event before launch, not after.
- Watch: task completion, drop-off points, INP field data, support contact themes, rage-click/dead-click signals.
- Fix the single biggest drop-off, then repeat. Resist redesign churn; iterate within the system (Rule 13).
- Update the project's CLAUDE.md with decisions, status, and pending items after every work session (per global session rules).

---

# PART J — AI CODING AGENT INSTRUCTIONS

## J1. Before coding

Identify:
1. The project archetype(s) (D0) and which playbook(s) apply
2. The user goal being served
3. The screen/component being built and what already exists to reuse
4. Which doctrine rules apply
5. Required states (F7, H6)
6. Accessibility requirements (F8)
7. Performance risks and budgets (B2)
8. Any AI/automation surfaces and their approval model (H)

Do not start with visual polish. Create structure, hierarchy, behavior, and states first.

## J2. During coding

- Use reusable components and system tokens; no hard-coded style values
- Semantic HTML; accessible controls; visible focus; clear labels
- Smart defaults; empty/loading/error/success states included, not deferred
- Outcome-based CTAs; trust-relevant information visible
- Mobile behavior implemented alongside desktop, not after
- Avoid unnecessary dependencies; every added script justified against the performance budget
- Animate transform/opacity only; respect reduced-motion
- Label AI output; gate agent actions; write to the activity log

## J3. After coding

Verify:
- Primary task works end-to-end
- All required states exist and render
- No zero-start where real progress exists; value precedes the ask where applicable
- No deceptive patterns (check against Part K)
- Accessibility basics pass (keyboard + labels + contrast + focus)
- Mobile works; performance budget holds
- Result matches this handoff; list assumptions and remaining gaps explicitly
- Output a completion report (per global rules) and update the project CLAUDE.md

## J4. Default build prompt

> Build this feature using the Master UI/UX/Product Handoff v2.
>
> Before coding: identify the project archetype and applicable playbook (Part D); the user goal; the primary action; applicable psychology rules (Part C); accessibility requirements (F8); required states (F7/H6); performance budget (B2); any AI/automation surfaces and their approval model (Part H).
>
> While coding: use system tokens and reusable components; semantic HTML; clear outcome-based CTAs; smart defaults; include empty, loading, error, success (and offline/AI) states; keep the UI calm, restrained, useful, and fast; no decorative bloat; no dark patterns; label AI output and gate agent actions.
>
> After coding: check the result against the acceptance criteria (I3) and QA gates (I4); explain what was built and which rules were applied; list assumptions and remaining gaps; update the project CLAUDE.md.

---

# PART K — NON-NEGOTIABLES & FINAL STANDARD

## K1. Never ship

- Blank dashboards with no next action
- Forms with placeholder-only labels
- Vague CTAs where the action can be specific
- Checkout or booking flows with hidden fees or late surprise costs
- Pricing with unclear billing, renewal, or cancellation terms
- Signup walls before value, unless the product truly requires it
- Fake urgency, false scarcity, fake countdowns, or fabricated social proof
- Misleading defaults or preselected consent for nonessential tracking
- Cancellation that is harder than signup
- Inaccessible custom controls or components without focus states
- Error states that don't help users recover; loading states that leave users uncertain
- Mobile layouts that are crushed desktop layouts
- AI output presented as certain when it is not; unlabeled AI content; agents that act irreversibly without approval; silent automation without a log
- Decorative animation that harms performance, clarity, or reduced-motion users
- One-off components that should be system components
- Third-party scripts that blow the performance budget for marginal value
- Anything that fails the test: "Would the user feel tricked after understanding what happened?"

## K2. Final product standard

The final product should feel: clear, useful, fast, honest, calm, modern, accessible, actionable, durable, trustworthy, light, focused — and where automation exists, *legible*.

It should never feel: bloated, confusing, manipulative, slow, trend-dependent, overdesigned, noisy, vague, deceptive, fragile, inaccessible — or haunted by machinery the user can't see or stop.

**Final rule:** design should reduce effort, increase confidence, and make the next correct action obvious. The "magic" users describe is nothing mystical — it is the compounding of removed friction, honest defaults, remembered context, instant feedback, and systems that explain themselves. If a design does not clarify, guide, protect, motivate honestly, or help the user complete a task, simplify it or remove it.

---

## APPENDIX — Verify-quarterly facts (as of July 8, 2026)

- Legal accessibility floor: WCAG 2.1 AA via EN 301 549 (EAA enforced since June 28, 2025); working target WCAG 2.2 AA; WCAG 3.0 is a draft (~2029)
- EU AI Act Article 50 transparency: enforceable August 2, 2026
- EU Digital Fairness Act: proposal expected Q4 2026 (dark patterns, addictive design)
- Core Web Vitals "good": LCP ≤2.5s · INP ≤200ms · CLS ≤0.1 (75th percentile)
- DTCG Design Tokens spec: stable 2025.10
- Express wallets: majority of mobile e-commerce transactions
- SaaS medians: ~37.5% activation; time-to-value target ≤7 days (top decile ≤3)
- Baymard: average checkout ~15 fields vs 6–8 needed; checkout redesign worth ~35% conversion lift
