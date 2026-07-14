"use client";
import { useEffect, useState } from "react";

interface ShipAlertButtonProps {
  orderNumber: string;
  email: string;
}

type AlertState = "idle" | "working" | "on" | "unsupported" | "denied" | "error";

/**
 * One-tap "ping me when it ships" opt-in shown with pre-ship order status.
 * Renders nothing when the browser can't do web push or the public VAPID
 * key isn't configured — no dead buttons.
 */
export function ShipAlertButton({ orderNumber, email }: ShipAlertButtonProps) {
  const [state, setState] = useState<AlertState>("idle");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      Boolean(vapidKey) &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }, [vapidKey]);

  if (!supported) return null;

  const enable = async () => {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        }));
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email, subscription: subscription.toJSON() }),
      });
      if (!response.ok) throw new Error("subscribe failed");
      setState("on");
    } catch {
      setState("error");
    }
  };

  if (state === "on") {
    return <p className="mt-5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-success">Shipping alert on — we&apos;ll ping this device when it ships.</p>;
  }
  if (state === "denied") {
    return <p className="mt-5 text-xs leading-relaxed text-muted">Notifications are blocked for this site. You&apos;ll still get the shipping email.</p>;
  }
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={enable}
        disabled={state === "working"}
        className="inline-flex min-h-11 items-center border border-border/60 px-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-cream transition-colors hover:border-accent hover:text-accent"
      >
        {state === "working" ? "Setting up..." : "Notify me when it ships"}
      </button>
      {state === "error" && <p className="mt-2 text-xs text-muted">Couldn&apos;t set the alert. The shipping email still has you covered.</p>}
    </div>
  );
}
