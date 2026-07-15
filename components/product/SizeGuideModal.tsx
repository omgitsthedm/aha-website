"use client";

import { useEffect, useState } from "react";
import type { SizeTable } from "@/lib/printful/size-table";

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  fitDescription?: string;
  careInstructions?: string;
  /** A representative Printful catalog variant id — used to fetch real measurements. */
  catalogVariantId?: number;
}

export function SizeGuideModal({ isOpen, onClose, fitDescription, careInstructions, catalogVariantId }: SizeGuideModalProps) {
  const [table, setTable] = useState<SizeTable | null>(null);
  const [loading, setLoading] = useState(false);

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

  // Load real measurements the first time the guide opens (cached server-side).
  useEffect(() => {
    if (!isOpen || !catalogVariantId || table) return;
    let active = true;
    setLoading(true);
    fetch(`/api/size-table?variant=${catalogVariantId}`)
      .then((r) => (r.ok ? r.json() : { table: null }))
      .then((data) => { if (active) setTable(data.table ?? null); })
      .catch(() => { /* fall back to fit description */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, catalogVariantId, table]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Size and fit guide">
      <div className="absolute inset-0 bg-void/80" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto border border-border/60 bg-void p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold uppercase tracking-[-0.03em] text-cream">Size &amp; fit</h2>
          <button type="button" onClick={onClose} className="min-h-11 font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted hover:text-cream">Close</button>
        </div>
        <div className="space-y-5 text-sm leading-relaxed text-muted">
          <div>
            <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent">Fit</p>
            <p className="text-cream">{fitDescription || "Standard unisex fit. Choose your usual size."}</p>
          </div>

          {loading && <p className="text-xs text-muted" aria-live="polite">Loading measurements…</p>}

          {table && (
            <div>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent">Measurements ({table.unit})</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr>
                      <th className="border-b border-border/40 py-2 pr-3 font-bold uppercase text-muted"> </th>
                      {table.sizes.map((s) => (
                        <th key={s} className="border-b border-border/40 px-2 py-2 text-center font-bold uppercase text-cream">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row" className="border-b border-border/20 py-2 pr-3 text-left font-bold text-cream">{row.label}</th>
                        {row.values.map((v, i) => (
                          <td key={i} className="border-b border-border/20 px-2 py-2 text-center font-mono text-cream/85">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">Measurements are of the garment, laid flat, from the manufacturer.</p>
            </div>
          )}

          <div>
            <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent">Care</p>
            <p className="text-cream">{careInstructions || "Machine wash cold, inside out. Tumble dry low. Do not iron the print."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
