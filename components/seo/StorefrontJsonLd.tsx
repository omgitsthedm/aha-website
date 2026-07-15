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
        description: "Clothing and accessories sold online and made to order.",
        email: "info@afterhoursagenda.com",
        logo: `${SITE_URL}/brand/icons/icon-512.png`,
        sameAs: [
          "https://www.instagram.com/afterhoursagenda",
          "https://www.tiktok.com/@afterhoursagenda",
          "https://www.facebook.com/afterhoursagenda",
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
