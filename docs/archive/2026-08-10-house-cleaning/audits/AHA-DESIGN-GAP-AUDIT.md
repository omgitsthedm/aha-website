# AHA Design Gap Audit

Baseline: 2026-07-10. Updated after the v3 full UI overhaul.

## Anti-pattern verdict

The old custom subway and blacklight system was removed. The active direction is Black Sheep Newsstand: dark ink, warm paper, one AHA pink, product-first layouts, calm commerce, and restrained motion.

## Findings

| Severity | Evidence | User/business impact | Location | Recommended action | Approval | Verification | Status |
|---|---|---|---|---|---|---|---|
| High | Raw colors remained throughout commerce components | Central contrast and theme control were impossible | Commerce components | Replaced with semantic tokens | No | Static scan plus lint/typecheck | Closed |
| High | Checkout used loud neon and heavy borders | Payment confidence and hierarchy suffered | `CheckoutForm.tsx` | Rebuilt as calm three-step payment surface | No | Browser and payment-state QA | Implemented, QA pending |
| Medium | Many bright accents competed in one view | Product focus weakened | Route-wide | Restricted brand color to one AHA pink | No | Static scan and screenshots | Closed |
| Medium | Legacy effect systems remained coupled to the homepage | Maintenance and performance cost without task value | Homepage and shared UI | Deleted unused systems and selectors | No | Import and build verification | Closed |

## Positive findings

- Existing Black Sheep assets remain distinctive.
- The route and commerce wireframe survived the visual reset.
- The token contract is now small enough to audit centrally.
- Truthful catalog and fulfillment language is shared across discovery and commerce.

## Direction

- Editorial: Black Sheep Newsstand with sharp type, real imagery, and one pink signal.
- Commerce: quiet, exact, product-first surfaces using the same token contract.
- Do not restore the retired subway, neon, zine-effect, or particle systems.
