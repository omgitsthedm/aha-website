"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ResilientImage } from "@/components/ui/ResilientImage";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

interface ImageLightboxProps {
  images: string[];
  index: number;
  alt: string;
  open: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/**
 * Full-screen product image viewer. Click/tap the image to zoom 2× toward the
 * pointer; arrow keys / on-screen controls move between images. Portal + focus
 * trap + ESC + backdrop close, mirroring the site's modal pattern. Mobile also
 * gets native pinch-zoom via touch-action on the zoom layer.
 */
export function ImageLightbox({ images, index, alt, open, onClose, onIndexChange }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState<{ on: boolean; x: number; y: number }>({ on: false, x: 50, y: 50 });
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (delta: number) => {
      setZoom({ on: false, x: 50, y: 50 });
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange]
  );

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    focusable?.[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key === "ArrowRight") { go(1); return; }
      if (event.key === "ArrowLeft") { go(-1); return; }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose, go]);

  if (!mounted || !open) return null;
  const src = images[index];
  if (!src) return null;

  const toggleZoom = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom((z) => (z.on ? { on: false, x: 50, y: 50 } : { on: true, x, y }));
  };

  return createPortal(
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`${alt} — image viewer`} className="fixed inset-0 z-[9999] flex flex-col bg-void/98">
      <div className="safe-top flex items-center justify-between px-4 py-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
          {images.length > 1 ? `${index + 1} / ${images.length}` : "Zoom"}
        </span>
        <button type="button" onClick={onClose} aria-label="Close image viewer"
          className="min-h-11 border border-border/60 px-4 text-xs font-bold uppercase tracking-wide text-cream hover:border-accent hover:text-accent">
          Close
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4">
        <div
          onClick={toggleZoom}
          className={`relative h-full w-full max-w-5xl ${zoom.on ? "cursor-zoom-out" : "cursor-zoom-in"}`}
          style={{ touchAction: "pinch-zoom" }}
        >
          <ResilientImage
            src={src}
            alt={alt}
            fill
            sizes="100vw"
            className={`${isPrintfulImage(src) ? "object-contain" : "object-contain"} transition-transform duration-200`}
            style={zoom.on ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            priority
          />
        </div>

        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous image"
              className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-border/60 bg-void/80 text-cream hover:border-accent hover:text-accent">‹</button>
            <button type="button" onClick={() => go(1)} aria-label="Next image"
              className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-border/60 bg-void/80 text-cream hover:border-accent hover:text-accent">›</button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="safe-bottom flex flex-wrap justify-center gap-2 px-4 pb-4">
          {images.map((image, i) => (
            <button key={image} type="button" onClick={() => { setZoom({ on: false, x: 50, y: 50 }); onIndexChange(i); }}
              aria-label={`View image ${i + 1}`} aria-current={i === index}
              className={`relative h-14 w-14 overflow-hidden border transition-colors ${i === index ? "border-accent" : "border-border/40 hover:border-cream"}`}>
              <ResilientImage src={image} alt="" fill className={isPrintfulImage(image) ? "object-contain" : "object-cover"} sizes="56px" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
