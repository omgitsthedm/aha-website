import type { Metadata } from "next";

/**
 * One builder for every page's title / description / canonical / Open Graph /
 * Twitter block, so the four can never drift apart.
 *
 * Why a helper and not per-page objects: Next **replaces** the parent
 * `openGraph` object, it does not merge it. A page that declares its own
 * `openGraph` silently loses the root's `siteName`, `locale` and image — which
 * is exactly what happened on product pages. Route every page through here and
 * the full card is re-declared every time.
 *
 * Usage in a static page:
 *
 *   export const metadata = buildMetadata({
 *     title: "About",
 *     description: "…",
 *     path: "/about",
 *   });
 *
 * Usage in `generateMetadata`: return the same call.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com").replace(/\/$/, "");

const SITE_NAME = "After Hours Agenda";
const LOCALE = "en_US";

/**
 * Verified 1200x630 PNG that survives the thumbnail test. Any override must be
 * the same shape — a raw square product photo reads as a cropped mystery at
 * feed size.
 */
const DEFAULT_IMAGE = {
  url: "/brand/og-image.png",
  width: 1200,
  height: 630,
  alt: "After Hours Agenda — script logo and the black sheep",
} as const;

export interface ShareImage {
  /** Root-relative ("/brand/og-image.png") or already absolute. */
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface BuildMetadataInput {
  /**
   * Page title WITHOUT the brand suffix — this is the `%s` in the root layout's
   * title template. The share cards get the suffix added back, because Open
   * Graph has no template and an untitled brand card is worse than none.
   */
  title: string;
  /** Optional share-card title when the browser title needs a different form. */
  shareTitle?: string;
  description: string;
  /** Site-root-relative path with a leading slash, e.g. "/shop/hoodies". */
  path: string;
  image?: ShareImage;
  /** "website" for everything except editorial/product detail. */
  type?: "website" | "article";
  /** Pass through for pages that must stay out of the index (empty categories). */
  robots?: Metadata["robots"];
}

/** Scrapers do not resolve relative URLs. Everything on a card ships absolute. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildMetadata({
  title,
  shareTitle: shareTitleOverride,
  description,
  path,
  image,
  type = "website",
  robots,
}: BuildMetadataInput): Metadata {
  const card = image ?? DEFAULT_IMAGE;
  const shareTitle = shareTitleOverride ?? `${title} | ${SITE_NAME}`;
  const imageUrl = absoluteUrl(card.url);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: shareTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      locale: LOCALE,
      type,
      images: [{ url: imageUrl, width: card.width, height: card.height, alt: card.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [imageUrl],
    },
    ...(robots ? { robots } : {}),
  };
}
