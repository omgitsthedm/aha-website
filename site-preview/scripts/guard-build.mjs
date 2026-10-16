import client from "../client.config.json" with { type: "json" };
const approved = process.env.AHA_PRODUCTION_BUILD === "approved";
const preview = client.site.previewOrigin;
const origin = new URL(process.env.PUBLIC_SITE_URL || preview);
if (
  origin.protocol !== "https:" ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw new Error("PUBLIC_SITE_URL must be an HTTPS origin.");
if (process.env.CONTEXT === "production" && !approved)
  throw new Error(
    "Production build refused. Explicit approval and the exact AHA origin are required.",
  );
if (!approved && origin.origin !== preview)
  throw new Error("Draft build must use its exact review origin.");
if (approved && origin.origin !== client.site.origin)
  throw new Error(
    "The prepared migration supports only the approved existing site. Review other targets separately.",
  );
console.log(
  `Building ${approved ? "approved production storefront" : "storefront review preview"} for ${origin.origin}`,
);
