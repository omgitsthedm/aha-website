# AHA Performance Audit

Baseline: 2026-07-10. Updated after the v3 overhaul and production-server audit.

## Build evidence

- Next.js 15.5.20 production build passes.
- Shared first-load JavaScript: 102 kB.
- Homepage first load: 112 kB.
- Checkout first load: 121 kB.
- PDP first load: 119 kB.
- Static generation succeeds for 28 routes.
- Local production Lighthouse: Home 92 performance, PDP 94 performance, both with CLS 0 and TBT 0.

## Findings

| Severity | Evidence | User/business impact | Location | Recommended action | Approval | Verification | Status |
|---|---|---|---|---|---|---|---|
| High | Lighthouse workflow is configured but HEAD Actions fail before steps execute | No CI-held live performance evidence | `.github/workflows/lighthouse.yml`, GitHub Actions | Repair execution and run against a started app/preview | Account action may be needed | Successful workflow artifacts | Open |
| Medium | GSAP and decorative effect systems increased homepage risk | Removed from runtime and dependencies; first-load home JS reduced from 162 kB to 112 kB | Homepage and package dependencies | Keep conversion surfaces free of decorative runtime libraries | No | Build and Lighthouse | Closed |
| Medium | Local Printful PNGs bypassed responsive optimization | Small cards downloaded oversized source images | Product cards and related cards | Restored `next/image` optimization | No | Lighthouse responsive-image audit | Closed; remaining estimate 33 KiB |
| Medium | Source archives contain many large raster/video assets and production coverage is not normalized | Future campaign work can regress LCP and transfer size | Client asset tree | Create derivative pipeline and explicit size budgets | No | Asset manifest and network trace | Open |
| Low | Unit run emits deprecated Vite CJS API warning | Future tooling upgrade risk, no present customer impact | test tooling | Resolve during non-breaking tooling pass | No | Clean test output | Open |

## Budgets

- LCP: <=2.0s preferred
- INP: <=150ms on primary actions
- CLS: <=0.05
- Marketing JS: <=150 kB compressed where practical
- Explicit image dimensions and responsive formats required

## Next evidence

- Preview/live Lighthouse baselines for home, shop, PDP, cart, checkout
- WebKit traces
- Real or emulated mobile 4G/CPU throttling
- Bundle dependency breakdown
- Image/video transfer and dimension audit
