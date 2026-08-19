export const CONSENT_STORAGE_KEY = "aha-cookie-consent";
export const CONSENT_RESOLVED_ATTRIBUTE = "data-aha-consent-resolved";

// Runs in <head> before body content can paint. Returning visitors and browsers
// sending GPC never flash the server-rendered prompt; fresh visitors keep the
// prompt and the privacy-first default. Storage failure deliberately falls
// through to the fresh-visitor path.
export const CONSENT_BOOTSTRAP = `try{const choice=localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)});if(navigator.globalPrivacyControl===true||choice==="granted"||choice==="denied")document.documentElement.setAttribute("${CONSENT_RESOLVED_ATTRIBUTE}","")}catch{}`;

