# AHA Component Inventory

Updated: 2026-07-10 after the v3 UI overhaul. There are 21 React component files under `components/`.

## Active components

- Cart: `AddToCartModal`, `CartDrawer`, `CartPageContent`, `CartProvider`
- Checkout: `CheckoutForm`
- Homepage: `Agenda`, `Collections`, `EditorialGallery`, `Entrance`, `GetOnTheList`, `LatestDrop`, `MostWanted`, `ThePromise`
- Product and shop: `ProductDetail`, `ShopContent`
- SEO: `ProductJsonLd`
- Shared UI: `AnnouncementBar`, `Footer`, `NavBar`, `PageHeader`, `RouteBadge`

## v3 consolidation result

| Previous issue | Resolution | Status |
|---|---|---|
| Commerce UI hard-coded old neon colors | Commerce components now use semantic tokens only | Closed |
| Duplicate modal and drawer focus behavior | Both trap focus, close with Escape, lock scroll, and restore prior focus | Closed |
| Homepage effect components had no stable design-system role | Map, dots, split-flap, reveal, grain, and divider components were deleted | Closed |
| Collection identity depended on multicolor subway lines | Replaced by neutral collection codes and one AHA pink | Closed |
| No shared route hierarchy | Added `PageHeader` | Closed |

## Remaining architecture opportunity

`CheckoutForm` still owns address, quote, wallet, card, and submission behavior in one client component. This is not a visual blocker, but future payment-method expansion should split those responsibilities behind tested contracts.
