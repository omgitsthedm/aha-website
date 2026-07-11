# AHA Accessibility Audit

Baseline: 2026-07-10. Target: WCAG 2.2 AA.

## Findings

| Severity | Evidence | User/business impact | WCAG/location | Recommended action | Approval | Verification | Status |
|---|---|---|---|---|---|---|---|
| High | Checkout errors are rendered as one page-level alert rather than programmatically associated field errors | Screen-reader and cognitive users cannot locate/fix invalid fields efficiently | 3.3.1, 3.3.3; `CheckoutForm.tsx` | Add field-level error state, focus, and descriptions | No | Keyboard + VoiceOver + integration tests | Open |
| High | Custom Google Pay container uses `role=button` and click handler without equivalent keyboard handling | Keyboard users may be blocked from wallet payment | 2.1.1, 4.1.2; `CheckoutForm.tsx` | Use Square-supported accessible control or implement full keyboard semantics | No | Keyboard E2E | Open |
| High | Cart drawers/modals need verified focus trap, Escape, focus return, and background inertness | Keyboard/SR users can lose context | 2.4.3, 2.1.2; cart components | Consolidate accessible dialog/drawer behavior | No | Playwright + VoiceOver | Open |
| Medium | Raw neon and pink colors were used directly in text and borders | Contrast could not be guaranteed by token-level checks | 1.4.3, 1.4.11; multiple components | Replaced with role-constrained semantic tokens | No | Automated plus manual contrast | Closed in code; contrast QA pending |
| Medium | No current automated accessibility workflow was observed executing successfully on HEAD | Regressions are not blocked | CI and E2E configuration | Add axe checks and repair CI execution | Account action may be needed | CI evidence | Open |

## Positive findings

- Visible labels and autocomplete attributes exist on checkout inputs.
- Touch targets are generally designed around 44px or larger.
- Reduced-motion support exists in the global design system.
- Semantic page routes and a public accessibility page exist.

## Required evidence before release

- Automated axe scan on all critical routes
- Keyboard-only browse, variant, cart, and checkout path
- VoiceOver pass
- 200% text zoom and narrow viewport pass
- Focus-not-obscured and safe-area checks
- Manual contrast review for both editorial and commerce layers
