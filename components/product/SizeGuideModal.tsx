"use client";

import { useEffect } from "react";

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  fitDescription?: string;
  careInstructions?: string;
}

export function SizeGuideModal({ isOpen, onClose, fitDescription, careInstructions }: SizeGuideModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-void/80" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg border border-border/10 bg-void p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold uppercase tracking-[-0.03em] text-cream">Fit & care</h2>
          <button type="button" onClick={onClose} className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted hover:text-cream">Close</button>
        </div>
        <div className="space-y-5 text-sm leading-relaxed text-muted">
          <div>
            <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent">Fit</p>
            <p className="text-cream">{fitDescription || "Standard unisex fit. Choose your usual size."}</p>
          </div>
          <div>
            <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent">Model</p>
            <p className="text-cream">Model is 5&apos;10&quot; and wears size M.</p>
          </div>
          <div>
            <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent">Care</p>
            <p className="text-cream">{careInstructions || "Machine wash cold, inside out. Tumble dry low. Do not iron the print."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
