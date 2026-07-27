"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image, { type ImageProps } from "next/image";

interface ResilientImageProps extends Omit<ImageProps, "onError"> {
  fallback?: ReactNode;
  onError?: ImageProps["onError"];
  /**
   * Fade the image in once it decodes. Automatically disabled for `priority`
   * images, and that exemption is the point: Chrome does not treat an
   * `opacity: 0` element as an LCP candidate, so fading the largest element in
   * pushes LCP out by the whole fade duration. Pass `fade={false}` for any
   * other image that is a plausible LCP candidate on its page.
   */
  fade?: boolean;
}

/**
 * Keeps a transient catalog/CDN failure from leaving a broken image control.
 * The state resets when the source changes, so galleries can recover normally.
 */
export function ResilientImage({
  src,
  alt,
  fallback,
  onError,
  onLoad,
  className,
  fade = true,
  priority,
  ...props
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);
  /**
   * Starts settled, so the server HTML, the first client render and a no-JS
   * render all show the image rather than stranding it at opacity 0. The mount
   * effect below re-checks `img.complete` and only arms the fade for a source
   * that is genuinely still in flight — which also covers a load that finished
   * before hydration, where React's `onLoad` never fires.
   */
  const [pending, setPending] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const sourceKey = typeof src === "string" ? src : "default" in src ? src.default.src : src.src;
  const fadeIn = fade && !priority;

  useEffect(() => {
    setFailed(false);
    setPending(fadeIn ? imgRef.current?.complete === false : false);
  }, [sourceKey, fadeIn]);

  if (failed) {
    return fallback ?? (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt ? `${alt} — image unavailable` : undefined}
        aria-hidden={alt ? undefined : true}
        className="absolute inset-0 flex items-center justify-center bg-surface px-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted"
      >
        Image unavailable
      </span>
    );
  }

  // Only ever *adds* `opacity-0`, never `opacity-100` — call sites such as the
  // shop-grid hover crossfade rely on their own opacity utilities, and once the
  // image has settled this leaves their classes exactly as they were.
  const classes = [
    className,
    fadeIn ? "transition-opacity duration-300 motion-reduce:transition-none" : undefined,
    pending ? "opacity-0" : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return (
    <Image
      {...props}
      ref={imgRef}
      src={src}
      alt={alt}
      priority={priority}
      className={classes || undefined}
      onLoad={(event) => {
        setPending(false);
        onLoad?.(event);
      }}
      onError={(event) => {
        setPending(false);
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
