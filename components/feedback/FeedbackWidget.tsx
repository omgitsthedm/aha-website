"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Site-wide review feedback. One button → one field → emails info@ with the
// reviewer's current page, their full navigation path this session, and context.
const HISTORY_KEY = "aha-feedback-history";
const MAX_HISTORY = 60;

interface Visit { path: string; at: string }

function readHistory(): Visit[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Record every page the reviewer lands on (their path/journey).
  useEffect(() => {
    if (!pathname) return;
    try {
      const hist = readHistory();
      const at = new Date().toISOString();
      if (hist[hist.length - 1]?.path !== pathname) hist.push({ path: pathname, at });
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(-MAX_HISTORY)));
    } catch { /* private mode — feedback still works, just without stored history */ }
  }, [pathname]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const submit = async () => {
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    const meta = {
      url: typeof window !== "undefined" ? window.location.href : "",
      viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      referrer: typeof document !== "undefined" ? document.referrer : "",
      at: new Date().toISOString(),
    };
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), currentPath: pathname, history: readHistory(), meta }),
      });
      if (!res.ok) throw new Error("send failed");
      setStatus("sent");
      setMessage("");
      window.setTimeout(() => { setOpen(false); setStatus("idle"); }, 1600);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="safe-bottom safe-x fixed bottom-4 right-4 z-[350] print:hidden">
      {open && (
        <div role="dialog" aria-label="Send feedback" className="mb-3 w-[min(20rem,calc(100vw-2rem))] border border-border/60 bg-void shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">Feedback</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close feedback" className="min-h-8 px-1 text-xs font-bold text-muted hover:text-cream">✕</button>
          </div>
          {status === "sent" ? (
            <p className="px-4 py-8 text-center text-sm font-bold text-success">Thanks — sent!</p>
          ) : (
            <div className="p-4">
              <label htmlFor="feedback-message" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-muted">What&rsquo;s on your mind about this page?</label>
              <textarea
                ref={textareaRef}
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Anything — a bug, a thought, something that felt off…"
                className="w-full resize-none border border-border/60 bg-void px-3 py-2 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <p className="mt-2 text-[10px] leading-snug text-muted">Your page and the path you took are included automatically.</p>
              {status === "error" && <p className="mt-2 text-xs font-bold text-danger">Couldn&rsquo;t send — try again.</p>}
              <button type="button" onClick={submit} disabled={!message.trim() || status === "sending"} className="btn-primary mt-3 w-full justify-center disabled:opacity-50">
                {status === "sending" ? "Sending…" : "Send feedback"}
              </button>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close feedback" : "Give feedback"}
        className="flex min-h-11 items-center gap-2 border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-void shadow-[0_6px_20px_rgba(0,0,0,0.2)] transition-transform active:scale-[0.97]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z" />
        </svg>
        Feedback
      </button>
    </div>
  );
}
