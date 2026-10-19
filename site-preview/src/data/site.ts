import products from "./products.json" with { type: "json" };
import client from "../../client.config.json" with { type: "json" };
import { collectionSlug, collectionsInOrder } from "./collections.ts";
import { allOffSale, onSale } from "../../server/catalog/off-sale.mjs";

export const brand = {
  name: client.client.name,
  email: client.client.email,
  official: client.site.origin,
  instagram: "https://www.instagram.com/afterhoursagenda",
  facebook: "https://www.facebook.com/afterhoursagenda/",
  verified: "2026-10-09",
  line: "For the dreamers and the doers.",
  // Square's own eGift card shop for this account: Square takes payment, emails
  // the card and owns the card terms. Cards are redeemed at checkout here.
  giftCards: "https://app.squareup.com/gift/1K2RDK7ZPFZXW/order",
};
export const navigation = [
  { label: "Shop", href: "/shop/" },
  { label: "The story", href: "/about/" },
  { label: "Lookbook", href: "/lookbook/" },
  { label: "Questions", href: "/faq/" },
  { label: "Contact", href: "/contact/" },
];
export const topics = [
  { slug: "order", name: "An existing order" },
  { slug: "product", name: "A piece or its fit" },
  { slug: "returns", name: "A return or quality issue" },
  { slug: "accessibility", name: "An accessibility issue" },
  { slug: "general", name: "Something else" },
];
// Short answers that point to the page that owns each topic.
export const answers = [
  {
    q: "Do you sell gift cards?",
    a: "Yes. Square sells and emails our digital gift cards. One card has to cover the whole order.",
    href: brand.giftCards,
    label: "Buy a gift card",
  },
  {
    q: "Can I place an order?",
    a: "Yes. Pick a size, add pieces to your bag and check out together. U.S. shipping is free.",
    href: "/shop/",
    label: "Go to the shop",
  },
  {
    q: "What is After Hours Agenda?",
    a: "A clothing brand for the dreamers and the doers, since 2011.",
    href: "/about/",
    label: "Read the story",
  },
  {
    q: "Does the lookbook show products for sale?",
    a: "Yes. Every campaign photo links to its piece. The photos are AI-generated mockups, and archive pieces aren’t for sale.",
    href: "/lookbook/",
    label: "See the lookbook",
  },
  {
    q: "Can you help with an existing order?",
    a: "Yes. Your order email has a private link that shows where your order is. For anything else, write to us with the order number.",
    href: "/track-order/",
    label: "Find your order",
  },
  {
    q: "How do I ask about a return or damaged item?",
    a: "Write to us with your order number and photos of any damage. Wait for instructions before sending anything back.",
    href: "/returns/",
    label: "Returns and damage",
  },
  {
    q: "Can I change an address?",
    a: "Write to us right away with your order number. A change depends on whether production or shipping has started.",
    href: "/shipping/",
    label: "Shipping details",
  },
  {
    q: "How long does an order take?",
    a: "About a week to make, then shipping. Each product page shows an estimated U.S. arrival date.",
    href: "/shipping/",
    label: "Shipping details",
  },
  {
    q: "How do I find my size?",
    a: "Lay a top you own flat and compare it with the size chart, or use Find my size on any product page.",
    href: "/size-guide/",
    label: "How to measure",
  },
];
export const gallery = [
  {
    image: "2012-the-after-hours-agenda-tee",
    alt: "The first After Hours Agenda wordmark tee from the 2012 brand archive.",
    caption: "Where the name began.",
    note: "Brand archive · 2012",
    kind: "portrait",
  },
  {
    image: "2013-love-vanity",
    alt: "Love / Vanity tee from the 2013 After Hours Agenda archive.",
    caption: "Love / Vanity.",
    note: "Brand archive · 2013",
    kind: "portrait",
  },
];
/** Pages that moved, served as permanent redirects (scripts/finalize.mjs writes _redirects). */
export const moved = [["/manifesto/", "/about/#manifesto"]] as const;
export const routes = [
  "/",
  "/about/",
  "/lookbook/",
  "/contact/",
  "/updates/",
  "/faq/",
  "/shop/",
  // Products off sale (src/data/off-sale.json) and collections with nothing on sale stay out of the sitemap.
  ...collectionsInOrder().filter(([, pieces]) => pieces.length && !allOffSale(pieces)).map(([name]) => `/shop/${collectionSlug(name)}/`),
  ...(onSale(products) as typeof products).map((product) => `/shop/${product.slug}/`),
  "/privacy/",
  "/terms/",
  "/accessibility/",
  "/shipping/",
  "/returns/",
  "/track-order/",
  "/size-guide/",
  "/care/",
];
