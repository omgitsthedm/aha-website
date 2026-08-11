"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useConsent } from "@/lib/consent/consent";
import { flushCommerceEvents } from "@/lib/analytics/events";
import { isCanonicalAnalyticsHost } from "@/lib/analytics/host";

/**
 * Lights up analytics the moment a measurement id is set in the environment —
 * and stays completely inert (renders nothing, loads nothing) until then.
 *
 * A direct GA4 tag (`NEXT_PUBLIC_GA4_ID`, `G-XXXXXXXXXX`) is the shipped path:
 * `trackCommerceEvent` calls `window.gtag` with real GA4 ecommerce parameters,
 * so no container mapping is needed. A GTM container (`NEXT_PUBLIC_GTM_ID`,
 * `GTM-XXXXXXX`) still takes precedence when one is configured, and receives
 * the historic `aha_*` dataLayer objects instead.
 *
 * Tracking is strictly opt-in: nothing loads until consent is granted. Add
 * Google Consent Mode here if granular EU consent categories are later needed.
 */
export function GoogleAnalytics() {
  const { consent } = useConsent();
  const granted = consent === "granted";
  // `useConsent` begins as null on both the server and first client render, so
  // this client-only hostname read cannot create a hydration mismatch.
  const canMount = granted && isCanonicalAnalyticsHost(window.location.hostname);

  // Commerce events raised before the tag finished loading are held in
  // lib/analytics/events.ts rather than dropped. Retry them from the top the
  // moment consent flips to granted and these scripts mount.
  useEffect(() => {
    if (canMount) flushCommerceEvents();
  }, [canMount]);

  if (!canMount) return null; // Opt-in plus canonical production host only.
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  const gaId = process.env.NEXT_PUBLIC_GA4_ID?.trim();

  if (gtmId) {
    return (
      <Script id="gtm-init" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
      </Script>
    );
  }

  if (gaId) {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
        </Script>
      </>
    );
  }

  return null;
}
