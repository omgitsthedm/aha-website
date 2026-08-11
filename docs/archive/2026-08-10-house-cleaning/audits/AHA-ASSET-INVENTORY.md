# AHA Asset Inventory

Baseline: 2026-07-10. This is a classification index, not approval to copy or modify assets.

## Source volumes

| Area | Files | Size | Initial classification |
|---|---:|---:|---|
| `Brand/` | 1,881 | 1.8 GB | Source-of-truth brand archive; needs selective review |
| `Logos/` | 604 | 194 MB | Source-of-truth identity archive; modification requires approval |
| `Products/` | 3,603 | 2.9 GB | Product art/mockups/source files; publication truth varies |
| `Website/` | 122 | 7.2 MB | Active repo pointer plus reference copy/strategy |
| `printful-file-library/` | 167 | 67 MB | Printful-linked production art references |
| `Ai Notes/` | 70 | not material | Cleanup logs and historical operational evidence |

Dominant formats: 3,391 PNG, 1,842 JPG, 510 PDF, 148 RTF, 100 TXT, 69 JPEG, 48 PSD, 33 AI, 32 SVG, 14 WebP, 10 AVIF, 9 MOV, and 9 MP4.

## Initial classification

| Asset group | Classification | Evidence/impact | Action | Approval | Status |
|---|---|---|---|---|---|
| Black Sheep identity files | Current candidate | Handoff identifies Black Sheep #5, left-facing only | Locate exact approved masters and usage rules | Required before alteration | Open |
| Existing repo sheep SVGs | Current in production | `public/brand/sheep-full.svg`, `sheep-head.svg` | Compare geometry/orientation to approved archive | No for read-only comparison | Open |
| Repo lifestyle images | Current in production | Four lifestyle files plus mosaic hero | Audit resolution, rights, crop coverage, garment accuracy | No for audit | Open |
| Product mockups and print files | Mixed | Large archive across PNG/JPG/PSD/AI and Printful library | Join each active SKU to source, mockup, art, and rights status | No for inventory; approval for publication changes | Open |
| Historical concepts/design explorations | Historical reference | Multiple Risograph/Ledger and earlier site concepts | Use as reference, not production truth | No | Open |
| Archived code/sites | Historical reference | `_archive-2026-07-08` and backup branch | Preserve; do not deploy or copy blindly | Required for deletion | Open |
| Videos/motion references | Usable with refinement | MOV/MP4 assets exist but coverage/rights unknown | Build duration, codec, rights, poster, breakpoint inventory | No for audit | Open |

## Required next evidence

- Exact Black Sheep #5 master file and approved lockups
- License/rights status for campaign and customer imagery
- Per-active-product front/back/detail/lifestyle coverage
- Color accuracy and resolution checks
- Responsive hero, PDP, grid, social, and OG derivatives
- Duplicate/hash review using existing `Ai Notes` manifests before copying assets
