export const CONSENT_STORAGE_KEY = "aha-cookie-consent";
export const CONSENT_RESOLVED_ATTRIBUTE = "data-aha-consent-resolved";

// Runs in <head> before body content can paint. Returning visitors and browsers
// sending GPC never flash the server-rendered prompt; fresh visitors keep the
// prompt and the privacy-first default. Storage failure deliberately falls
// through to the fresh-visitor path.
export const CONSENT_BOOTSTRAP = `try{const choice=localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)});if(navigator.globalPrivacyControl===true||choice==="granted"||choice==="denied")document.documentElement.setAttribute("${CONSENT_RESOLVED_ATTRIBUTE}","")}catch{}`;

// Diagnostic/repair for a paint-timing stall observed under Lighthouse on
// static routes: with any web font in flight, Chrome's first contentful paint
// slipped to the next unrelated repaint (~1.3-2.3 s) even though every font
// finished by ~450 ms. Forcing one animation frame + a style invalidation once
// the FontFaceSet settles guarantees the swapped-in text is presented promptly.
export const FONT_PAINT_KICK = `if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){requestAnimationFrame(function(){document.documentElement.setAttribute("data-aha-fonts","ready")})})}`;
