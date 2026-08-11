"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const FeedbackWidget = dynamic(
  () => import("./FeedbackWidget").then((module) => module.FeedbackWidget),
  { ssr: false }
);

export function LazyFeedbackWidget() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idleApi = window as unknown as {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof idleApi.requestIdleCallback === "function") {
      const id = idleApi.requestIdleCallback(() => setReady(true), { timeout: 2_000 });
      return () => idleApi.cancelIdleCallback?.(id);
    }

    const id = setTimeout(() => setReady(true), 1_000);
    return () => clearTimeout(id);
  }, []);

  return ready ? <FeedbackWidget /> : null;
}
