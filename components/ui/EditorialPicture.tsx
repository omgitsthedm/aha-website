import Image from "next/image";
import { preload } from "react-dom";
import { getOptimizedEditorial, optimizedSrcSet } from "@/lib/content/editorial-optimized";

interface EditorialPictureProps {
  src: string;
  alt: string;
  /** The `sizes` attribute — the same string you would give next/image. */
  sizes: string;
  /** LCP candidate: eager, fetchpriority=high, and a typed AVIF preload in <head>. */
  priority?: boolean;
  /** For an above-the-fold image that must NOT compete with the LCP (e.g. the second hero panel). */
  deprioritize?: boolean;
  className?: string;
}

/**
 * A fill-positioned editorial image served from the pre-encoded AVIF/WebP set
 * in public/editorial/opt (see scripts/imagery/encode-editorial.mjs), with the
 * original JPEG as the last-resort fallback.
 *
 * Why not next/image here: on the CDN the optimizer path only ever returned
 * WebP at q75 (67 KB for the home hero); the pre-encoded AVIF of the same frame
 * is 25 KB, and a preload with `type="image/avif"` lets the browser fetch that
 * exact file from the <head>. Slots without an encoded entry fall back to
 * next/image unchanged, so the swap guide still applies file-for-file.
 */
export function EditorialPicture({ src, alt, sizes, priority = false, deprioritize = false, className = "" }: EditorialPictureProps) {
  const entry = getOptimizedEditorial(src);
  if (!entry) {
    return <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={className} loading={priority ? undefined : "lazy"} />;
  }
  const avif = optimizedSrcSet(entry, "avif");
  const webp = optimizedSrcSet(entry, "webp");
  const middle = entry.widths[Math.floor(entry.widths.length / 2)];
  if (priority) {
    preload(`/editorial/opt/${entry.name}-${middle}.avif`, { as: "image", type: "image/avif", imageSrcSet: avif, imageSizes: sizes, fetchPriority: "high" });
  }
  return (
    <picture>
      <source type="image/avif" srcSet={avif} sizes={sizes} />
      <source type="image/webp" srcSet={webp} sizes={sizes} />
      <img
        src={src}
        alt={alt}
        width={entry.width}
        height={entry.height}
        sizes={sizes}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : deprioritize ? "low" : "auto"}
        className={`absolute inset-0 h-full w-full ${className}`}
      />
    </picture>
  );
}
