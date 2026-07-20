"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image, { type ImageProps } from "next/image";

interface ResilientImageProps extends Omit<ImageProps, "onError"> {
  fallback?: ReactNode;
  onError?: ImageProps["onError"];
}

/**
 * Keeps a transient catalog/CDN failure from leaving a broken image control.
 * The state resets when the source changes, so galleries can recover normally.
 */
export function ResilientImage({ src, alt, fallback, onError, ...props }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);
  const sourceKey = typeof src === "string" ? src : "default" in src ? src.default.src : src.src;

  useEffect(() => {
    setFailed(false);
  }, [sourceKey]);

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

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
