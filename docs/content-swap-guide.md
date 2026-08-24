# Content swap guide

The storefront is live on the APLIIQ capsule. This is the current path for a deliberately approved product or content replacement. Each step names the file or system that owns the content.

## 1. A new product (or a redesigned one)

Owner: `data/apliiq-capsule.json` → APLIIQ → Square → `data/apliiq-map.json` → `data/product-manifest.json`.

1. **Art.** Drop the print file at `public/art/<slug>.png`: transparent PNG, at least 300 DPI at print size (10 in wide is about 3000 px), under 12 MB.
2. **Spec, story, and approval evidence.** Add exactly one product to `data/apliiq-capsule.json`: `slug`, `title`, `productCode`, `frontLocationId`, `retailPrice` in integer cents, `sizeGuideId`, `fabricDescription`, `printNote`, authored paragraph HTML in `story`, and valid HTTPS `artworkUrl` and `mockupUrl` values. A new design may be prepared before its provider ids exist. After design preparation, rerun the dry preflight and copy its exact expected SHA-256 into `approvals.productionFingerprint`; add `approvals.mapping` and `approvals.sample`, each with `status: "approved"` and a real `approvedAt` date in `YYYY-MM-DD` form. This evidence must be entered only after human review and is never written automatically.
3. **Imagery.** `python3 scripts/imagery/render-product-imagery.py <slug>` renders `front.jpg`, `detail.jpg`, and `art.jpg` into `public/products/<slug>/`. All three nonempty files are required by the publisher. Real approved photography may replace those files.
4. **Preview the complete publish.** Run the read-only preflight:

   ```bash
   npm run publish:apliiq -- --slug <slug>
   ```

   It fails closed on an incomplete spec or missing image/story/price/size guide. Missing provider records are listed as planned steps; the dry run never calls APLIIQ or Square. Once a design exists, it also prints the exact expected production fingerprint and stops on missing or stale approval evidence. The fingerprint binds slug, blank/color/location, design, artwork, service/note, the explicit private-label attachment status, size guide, and every sorted size/APQ SKU. Current designs use `privateLabelStatus: "not-attached"`; no label or label cost is claimed. No map, Square, manifest, site, or feed activation can run until both approvals match it. Existing mapped variants carry approval only while that committed production identity, including private-label status and size guide, is unchanged.
5. **Apply the complete publish.** When the plan is correct and provider credentials are available, apply it explicitly:

   ```bash
   npm run publish:apliiq -- --slug <slug> --apply
   ```

   Apply creates or skips the selected APLIIQ design, requires A1 SKUs, derives only the selected map entries, creates or resumes the Square item with its images/copy, requires all Square ids, writes the manifest and sellable slugs, runs `validate:all`, and verifies local product-route/feed eligibility. It never deletes or archives anything.
6. **Review and release.** Open a pull request. The end-to-end publisher begins every `--apply` on a completely clean non-main branch, then allows only its known generated product files to change while the branch and starting commit remain fixed. Standalone APLIIQ and Square `--apply` commands also require a clean non-main branch; lower-level APLIIQ create/map requires exactly one slug, and map apply refuses to activate until a fresh Square provider GET verifies the complete item, every variation mapping, and the expected commerce fields. The publisher never pushes `main`. `--apply --commit` may create the focused generated-product commit, including `data/apliiq-capsule-designs.json`, and `--apply --commit --push` may push that branch to `origin`. `--push` without `--commit`, a dirty starting tree, detached HEAD, and `main` are refused.

Retirement is intentionally not part of this publisher. Removing, drafting, detaching, deleting, or archiving a product requires a separate, explicitly reviewed operation.

## 2. Photography and editorial imagery

Owner: `data/brand-imagery.json`. Every non-product image slot on the site is listed there with `src`, `alt`, `aspect`, `placeholder` and `source`.

- Replace the file at `src` (same aspect) or point `src` at a new file under `public/editorial/`, update `alt`, set `placeholder: false`.
- Slots: `hero` (home + lookbook cover, 16:9, subject on the right, dark left third), `maker` (home story + about, 16:9), `categories` (two tiles), `lookbook` (any number; `productSlug` links a frame to its piece), `signature` (the Black Sheep on-model pair), `archive` (history strip; keep the year and caption).
- Product photos from the shoot go to Square as the item images (front first) through the step 1.5 apply command, not into this file.

## 3. Copy

- **Product stories** are authored in the capsule spec and converged to Square `description_html`. Preview with `npm run square:capsule -- copy <slug>` and add `--apply` only for the intended live write after the selected design's identity-bound approvals pass; the PDP, JSON-LD, and previews read the resulting copy.
- **Site copy** (home, about, manifesto, FAQ, shipping, returns) is in the page files under `app/`; windows and claims come from `lib/commerce/policies.ts` (production days, returns window, shipping sentence, country list). Change a number once, there.
- **Size guides**: `data/size-guides.json` — manufacturer garment specs per blank.

## 4. What is placeholder today

`data/brand-imagery.json` marks each: the rooftop and subway frames are AI-generated (plain black garments, no graphics), the on-model Black Sheep pair is a print-provider render of the previous run, the archive strip is real 2012–2014 brand material. Product imagery is studio renders of the actual print files. Swap in the shoot with §2; nothing else changes.
