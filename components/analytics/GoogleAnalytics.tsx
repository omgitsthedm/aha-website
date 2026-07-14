import Script from "next/script";

/**
 * Lights up analytics the moment a measurement id is set in the environment —
 * and stays completely inert (renders nothing, loads nothing) until then. This
 * is the missing half of the funnel: `trackCommerceEvent` already pushes
 * `aha_*` events to `window.dataLayer`, but nothing consumed them.
 *
 * Prefers a GTM container (`NEXT_PUBLIC_GTM_ID`, `GTM-XXXXXXX`) — it initialises
 * `dataLayer` and can map the existing `aha_*` events to GA4 ecommerce without
 * a code change. Falls back to a direct GA4 tag (`NEXT_PUBLIC_GA4_ID`,
 * `G-XXXXXXXXXX`) for a simple pageview + custom-event setup.
 *
 * No consent gate exists on the site yet; this is basic first-party analytics.
 * Add Google Consent Mode here if EU compliance is later required.
 */
export function GoogleAnalytics() {
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
