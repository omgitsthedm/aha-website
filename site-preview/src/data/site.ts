import products from "./products.json" with { type: "json" };
import client from "../../client.config.json" with { type: "json" };
import { collectionSlug, collectionsInOrder } from "./collections.ts";

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
  { label: "Answers", href: "/faq/" },
  { label: "Contact", href: "/contact/" },
];
export const topics = [
  { slug: "order", name: "An existing order" },
  { slug: "product", name: "A piece or its fit" },
  { slug: "returns", name: "A return or quality issue" },
  { slug: "accessibility", name: "An accessibility issue" },
  { slug: "general", name: "Something else" },
];
export const answers = [
  {
    q: "Do you sell gift cards?",
    a: "Yes. Digital gift cards are sold and emailed by Square, our payment provider, and can be used at checkout here. A gift card covers a whole order; if its balance is lower than the total, pay with a card instead.",
    href: brand.giftCards,
    label: "Buy a gift card",
  },
  {
    q: "Can I place an order?",
    a: "Yes. Choose a current piece, select your size and quantity, and add it to your bag. You can check out with multiple products together through Square. Domestic shipping is free.",
    href: "/shop/",
    label: "Shop the collection",
  },
  {
    q: "What is After Hours Agenda?",
    a: "A clothing brand for the dreamers and the doers. Graphic tees, heavyweight hoods and crewnecks are part of our story. We believe in kindness, community and celebrating the life you are building.",
    href: "/about/",
    label: "Read the story",
  },
  {
    q: "Does the lookbook show products for sale?",
    a: "The current collection appears in AI-generated lifestyle mockups. Garment views and measurements are on each product page. Historical archive pieces are separately labeled and are not for sale.",
    href: "/lookbook/",
    label: "Explore the lookbook and archive",
  },
  {
    q: "Can you help with an existing order?",
    a: "Yes. Email info@afterhoursagenda.com with the order number and the email used at checkout. Never include a card number, security code or password.",
    href: "/contact/?topic=order",
    label: "Get help with an existing order",
  },
  {
    q: "How do I ask about a return or damaged item?",
    a: "Email support with the order number, the item and a description of the issue. Include clear photos when relevant. Requests are reviewed under the terms that applied when the order was placed. Wait for instructions before returning anything.",
    href: "/returns/",
    label: "Read the return request steps",
  },
  {
    q: "Can I change an address?",
    a: "Contact support as soon as possible with your order number and the corrected address. Whether a change can be made depends on the order’s production and shipping stage.",
    href: "/shipping/",
    label: "Get shipping help",
  },
  {
    q: "How long does an order take?",
    a: "Each piece is made to order. Production usually takes about a week, and shipping time depends on the destination. Artwork review or a stock delay can add time. We send tracking once the order ships.",
    href: "/shipping/",
    label: "Read shipping details",
  },
  {
    q: "How do I contact you?",
    a: "The Contact page prepares an email draft for you to review. You can also email info@afterhoursagenda.com. For an order question, include your order number and checkout email. Nothing is sent automatically.",
    href: "/contact/",
    label: "Contact After Hours Agenda",
  },
  {
    q: "How do I check the fit of a piece I already own?",
    a: "Start with its label and original size chart. Lay a similar garment flat and compare its chest width and length. Sizes can differ between pieces and past collections. Send us the item name if you need help finding the right information.",
    href: "/size-guide/",
    label: "See how to measure a garment",
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
export const routes = [
  "/",
  "/about/",
  "/lookbook/",
  "/manifesto/",
  "/contact/",
  "/updates/",
  "/faq/",
  "/shop/",
  ...collectionsInOrder().filter(([, pieces]) => pieces.length).map(([name]) => `/shop/${collectionSlug(name)}/`),
  ...products.map((product) => `/shop/${product.slug}/`),
  "/privacy/",
  "/terms/",
  "/accessibility/",
  "/shipping/",
  "/returns/",
  "/track-order/",
  "/size-guide/",
  "/care/",
];
