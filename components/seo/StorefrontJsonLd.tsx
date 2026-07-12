const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

export function StorefrontJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore",
        "@id": `${SITE_URL}/#store`,
        name: "After Hours Agenda",
        url: SITE_URL,
        logo: `${SITE_URL}/brand/sheep-head.svg`,
        image: `${SITE_URL}/brand/mosaic-hero.webp`,
        description: "Independent New York streetwear and made-to-order graphic apparel.",
        email: "info@afterhoursagenda.com",
        sameAs: [
          "https://instagram.com/afterhoursagenda",
          "https://tiktok.com/@afterhoursagenda",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "After Hours Agenda",
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#store` },
        inLanguage: "en-US",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
