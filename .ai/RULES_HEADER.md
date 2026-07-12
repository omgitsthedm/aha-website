# After Hours Agenda AI-Ops Rules Header

Project Code:

LFNYC-AHA

Project Name:

After Hours Agenda

Business Line:

After Hours Agenda under Little Fight NYC

Tier:

Tier 3 - Live Commerce / Internal Brand

Risk:

High

Canonical Path:

/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website/aha-website

Remote:

https://github.com/omgitsthedm/aha-website.git

Host:

Netlify

Live URL:

https://afterhoursagenda.com

Stack:

Next.js / Netlify custom commerce storefront

Commerce:

Square + Printful referenced; `app/api/checkout` present

Related Non-Canonical Folder:

`~/Desktop/Personal/OpenClaw_Local/aha_marketing_ai` - separate marketing-AI tool, not canonical storefront

## Locked Rules

- After Hours Agenda is under Little Fight NYC.
- AHA is a live commerce brand and must be treated as high risk.
- Do not place live orders.
- Do not run checkout/payment tests without sandbox or explicit David-run safe path.
- Do not alter products, inventory, customers, orders, fulfillment, shipping, tax, discounts, analytics, or live commerce data without explicit approval.
- Do not publish Netlify or storefront changes without explicit approval.
- Do not modify Square or Printful behavior without explicit approval.
- Do not inspect `.env` contents.
- Do not modify `.env` files.
- Do not modify product catalog or reorganization files without explicit approval.
- AHA checkout/payment/fulfillment actions are transactional.
- Live commerce changes require human-approved safe path.
- Clear, scoped plain-language confirmation is sufficient for high-risk live changes; no fixed wording or capitalization is required.
- Dirty/untracked files must be recorded, not cleaned or committed, unless David explicitly approves.

## Do Not Touch

- `.env`
- `.env.local`
- `PRODUCT_CATALOG.json`
- `REORGANIZATION_LOG.csv`
- checkout/payment code
- Square integration behavior
- Printful integration behavior
- product/inventory/customer/order/fulfillment data
- Netlify deploy settings
- live commerce analytics/pixels unless explicitly approved

## AHA QA Harness Map

Observational checks an agent may run later:

- `git status`
- `git remote`
- `git branch`
- `git log`
- read package/config files
- read-only Netlify config inspection if local
- public GET to storefront pages if explicitly requested
- non-mutating page render checks
- read-only inspection of product catalog filenames/metadata, not mutation

Transactional/gated checks:

- checkout
- payment
- order creation
- customer creation/update
- inventory/product mutation
- Square actions
- Printful actions
- fulfillment actions
- customer email triggers
- live deploy/publish
- discount/tax/shipping changes
- analytics/pixel changes
