# Multi-channel distribution (store · Google · Meta/IG/FB · Etsy · TikTok Shop)

Goal: a design created once reaches the store **and** Google, Instagram/Facebook,
Etsy, and TikTok Shop. There are **two mechanisms** — most brands use both.

## The two models

**Model A — everything points to your store (feed-driven).**
Google Shopping and Meta (Instagram/Facebook) show your site's products as ads /
shopping tags that **link back to afterhoursagenda.com** (Square checkout). One
source of truth, one place customers pay, Printful fulfills. Powered by the
**product feed** (now live).

**Model B — Printful lists natively (channel-driven).**
Printful connects to Etsy and TikTok Shop as separate stores. A product pushed
to those channels becomes a native listing there with **that marketplace's own
checkout**, fulfilled by Printful. Reaches those marketplaces' built-in traffic.

---

## ✅ Already done on the site (the backbone)
- **Product feed:** `https://afterhoursagenda.com/product-feed.xml` — valid Google
  Shopping RSS (id, title, price, availability, image, brand, size, free
  shipping), 1,100+ variants, auto-refreshes hourly. Feeds Google + Meta + TikTok
  catalogs.
- **Social:** Instagram, TikTok, Facebook in the footer + `Organization.sameAs`
  (`@afterhoursagenda` on all three).
- **Optional next (site side, I can add):** Meta pixel (`fbq`) + TikTok pixel
  (`ttq`) loaders — env-gated like GA, inert until you set the IDs — for shopping
  tags + retargeting.

## 👤 What YOU connect (needs your accounts + OAuth — I can't do these)

### Google Shopping (Model A)
1. Create/So log in **Google Merchant Center** (merchants.google.com).
2. Verify + claim the domain `afterhoursagenda.com`.
3. Products → Feeds → add a scheduled feed → URL: `https://afterhoursagenda.com/product-feed.xml`.
4. (To run ads) link Merchant Center to a **Google Ads** account → Performance Max / Shopping.

### Meta — Instagram & Facebook Shopping (Model A)
1. **Meta Commerce Manager** (business.facebook.com) → create a **Catalog**.
2. Add a **data feed** → the same feed URL above (scheduled), *or* connect Printful.
3. Connect the catalog to the Instagram + Facebook Page `@afterhoursagenda` →
   enable Shopping → tag products in posts.
4. Add the **Meta Pixel** id to Netlify env (once I ship the loader) for tracking.

### Etsy (Model B — via Printful)
1. Create an **Etsy seller account** (etsy.com/sell).
2. Printful dashboard → **Stores → Add store → Etsy** → OAuth connect.
3. Push products from Printful to the Etsy store (or enable auto-sync). Printful
   fulfills Etsy orders.

### TikTok Shop (Model B — via Printful) + TikTok catalog (Model A)
1. **TikTok Shop seller account** (seller-us.tiktok.com) — requires business
   verification; approval takes days.
2. Printful dashboard → **Stores → Add store → TikTok Shop** → connect.
3. For TikTok *ads* (not native Shop), use the feed URL in TikTok Business →
   catalog, + the TikTok Pixel.

---

## The "one design → everywhere" workflow, realistically
- **Store + Google + Meta:** automatic once the feeds/catalogs above are connected
  — you add a product with the existing product-factory pipeline and it flows to
  all three (feed refreshes hourly).
- **Etsy + TikTok Shop:** create the product in **Printful** and push to the
  connected channels (or enable Printful auto-sync). This is the one manual-ish
  step, because those are native marketplace listings.

## Notes / gotchas
- Google/Meta require **domain verification** and can take 1–3 days to approve a
  new catalog; TikTok Shop seller verification is the slowest.
- Keep prices ≥ the 35% margin floor across all channels (marketplace fees eat
  margin — Etsy ~6.5%, TikTok Shop commission — factor them in).
- Honesty laws still apply everywhere: no fake urgency/scarcity/reviews.
