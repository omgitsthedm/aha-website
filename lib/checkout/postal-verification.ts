// Purchase-time postal verification. Kept out of the React component — like
// lib/checkout/express.ts — so the one decision here that can REFUSE a sale is
// unit-testable without a browser or a live api.zippopotam.us.
//
// WHY IT BLOCKS: carriers route on the ZIP, not on the city. "Brooklyn, NY
// 02134" leaves for Boston, fails delivery, and comes back to AHA at AHA's
// cost — return postage plus a refunded order. The checkout form is the only
// cheap place to catch it.
//
// WHY IT FAILS OPEN: the lookup is a free third-party service with no SLA. If
// it can't be reached (offline, CSP, 5xx, timeout) the shopper must still be
// able to buy. Only a DEFINITIVE contradiction stops a sale: a locally invalid
// format, or a resolved place that disagrees with the typed city/state.
//
// "WE CAN'T FIND IT" IS NOT A CONTRADICTION. api.zippopotam.us is a free
// GeoNames extract, not USPS. Probed live against the real service it 404s on
// 09021 and 09501 (APO/AE, APO/AA), 00901 / 00601 / 00926 (Puerto Rico), 96910
// (Guam), 00802 (US Virgin Islands) and 96799 (American Samoa) — every one of
// them a deliverable US ZIP. Refusing those turns away military families and
// territory customers, which is strictly worse than the return-to-sender the
// check exists to prevent. So there is deliberately NO lookup status that can
// produce a "blocked" verdict on its own: absence and unreachability both land
// on "unverified". Adding a status back is a compile error until the switch in
// verifyPostalCode below decides what it means.

export interface PostalPlace {
  city: string;
  /** Full state/province name, e.g. "New York". */
  state: string;
  /** Two-letter code where the country has one, e.g. "NY". */
  stateCode: string;
}

/**
 * What the network layer found for a (country, code) pair. Every non-"resolved"
 * status is a form of "we could not confirm", and none of them may block — see
 * the header. There is no "this code does not exist" variant on purpose.
 */
export type PostalLookup =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "resolved"; places: PostalPlace[] }
  /**
   * The service answered 404: this code is absent from a free GeoNames
   * extract. NOT "no such code" — carried as its own status only so the UI can
   * nudge the shopper to look twice. Never blocks a sale.
   */
  | { status: "not-in-dataset" }
  /** Offline / CSP / 5xx / timeout / unreadable body — never blocks a sale. */
  | { status: "unavailable" };

export interface PostalSuggestion {
  city: string;
  state: string;
}

export type PostalVerdict =
  /** Nothing to check yet, or a country we can't check. */
  | { status: "skipped" }
  | { status: "checking" }
  | { status: "ok"; place?: PostalSuggestion }
  /** Checked and could not confirm, but not a contradiction — sale proceeds. */
  | { status: "unverified" }
  | { status: "blocked"; message: string; suggestion?: PostalSuggestion };

interface PostalFormat {
  pattern: RegExp;
  /** api.zippopotam.us wants the base code, not ZIP+4. */
  toLookupCode: (code: string) => string;
  invalidMessage: string;
}

/**
 * Only countries whose FULL postal code resolves 1:1 in zippopotam.us are
 * verified. Canada (3-character FSA only) and the UK (outward code only) 404 on
 * a complete postcode, so a blocking check there would refuse every legitimate
 * Canadian and British order — a far worse outcome than a return-to-sender.
 */
const POSTAL_FORMATS: Record<string, PostalFormat> = {
  US: {
    pattern: /^\d{5}(?:-\d{4})?$/,
    toLookupCode: (code) => code.slice(0, 5),
    invalidMessage: "Enter a valid 5-digit US ZIP code.",
  },
  AU: {
    pattern: /^\d{4}$/,
    toLookupCode: (code) => code,
    invalidMessage: "Enter a valid 4-digit Australian postcode.",
  },
};

/** Word-level equivalences so a legitimate spelling variant never blocks a sale. */
const NAME_WORD_ALIASES: Record<string, string> = {
  st: "saint",
  ste: "sainte",
  ft: "fort",
  mt: "mount",
  mtn: "mountain",
  hts: "heights",
  spgs: "springs",
};

/**
 * USPS delivers anything addressed to a valid NYC ZIP regardless of which of
 * these names is on the label, and AHA's home market types them
 * interchangeably ("New York" for a Brooklyn ZIP, constantly). Blocking those
 * would cost real sales for zero deliverability gain.
 */
const NYC_DELIVERY_NAMES = new Set([
  "new york",
  "new york city",
  "nyc",
  "manhattan",
  "brooklyn",
  "bronx",
  "the bronx",
  "queens",
  "staten island",
]);

/** Case/accent/punctuation-insensitive place-name key. */
export function normalizePlaceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => NAME_WORD_ALIASES[word] ?? word)
    .join(" ");
}

export function isPostalVerifiableCountry(country: string): boolean {
  return Boolean(POSTAL_FORMATS[country.trim().toUpperCase()]);
}

/**
 * The code to look up, or null when the country isn't verifiable, nothing has
 * been typed yet, or the format is wrong (the verdict reports that separately —
 * a bad format needs no network call).
 */
export function postalLookupCode(country: string, zip: string): string | null {
  const format = POSTAL_FORMATS[country.trim().toUpperCase()];
  const code = zip.trim();
  if (!format || !code || !format.pattern.test(code)) return null;
  return format.toLookupCode(code);
}

export function postalLookupUrl(country: string, lookupCode: string): string {
  return `https://api.zippopotam.us/${country.trim().toLowerCase()}/${encodeURIComponent(lookupCode)}`;
}

export function parseZippopotamPlaces(payload: unknown): PostalPlace[] {
  const places = (payload as { places?: unknown } | null | undefined)?.places;
  if (!Array.isArray(places)) return [];
  const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
  const parsed: PostalPlace[] = [];
  for (const entry of places) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const city = text(record["place name"]);
    const state = text(record.state);
    const stateCode = text(record["state abbreviation"]);
    if (!city) continue;
    parsed.push({ city, state: state || stateCode, stateCode: stateCode || state });
  }
  return parsed;
}

function placeLabel(place: PostalPlace): PostalSuggestion {
  return { city: place.city, state: place.stateCode || place.state };
}

function stateMatches(place: PostalPlace, typedState: string): boolean {
  const typed = normalizePlaceName(typedState);
  if (!typed) return true; // the required-field check owns an empty state
  return typed === normalizePlaceName(place.stateCode) || typed === normalizePlaceName(place.state);
}

function cityMatches(place: PostalPlace, typedCity: string): boolean {
  const typed = normalizePlaceName(typedCity);
  if (!typed) return true; // the required-field check owns an empty city
  const resolved = normalizePlaceName(place.city);
  if (typed === resolved) return true;
  const inNewYork = normalizePlaceName(place.stateCode) === "ny" || normalizePlaceName(place.state) === "new york";
  return inNewYork && NYC_DELIVERY_NAMES.has(typed) && NYC_DELIVERY_NAMES.has(resolved);
}

export interface PostalVerificationInput {
  country: string;
  zip: string;
  city: string;
  state: string;
  lookup: PostalLookup;
}

/**
 * Pure verdict for the typed address against whatever the lookup found. The
 * caller blocks submission on — and only on — `status === "blocked"`.
 */
export function verifyPostalCode(input: PostalVerificationInput): PostalVerdict {
  const format = POSTAL_FORMATS[input.country.trim().toUpperCase()];
  const code = input.zip.trim();
  if (!format || !code) return { status: "skipped" };
  // A locally invalid code is a contradiction we can prove offline.
  if (!format.pattern.test(code)) return { status: "blocked", message: format.invalidMessage };

  switch (input.lookup.status) {
    case "idle":
      return { status: "skipped" };
    case "checking":
      return { status: "checking" };
    // Unreachable, and absent-from-the-dataset, are the same verdict: we could
    // not confirm, so we do not refuse.
    case "unavailable":
    case "not-in-dataset":
      return { status: "unverified" };
    case "resolved":
      break;
    default: {
      // A new PostalLookup status stops compiling here until it is handled
      // above; at runtime an unrecognised one falls open instead of throwing.
      const unhandled: never = input.lookup;
      void unhandled;
      return { status: "unverified" };
    }
  }

  const places = input.lookup.places;
  if (places.length === 0) return { status: "unverified" };

  const typedCity = input.city.trim();
  const typedState = input.state.trim();
  if (!typedCity && !typedState) return { status: "ok", place: placeLabel(places[0]) };

  const stateCandidates = places.filter((place) => stateMatches(place, typedState));
  const match = stateCandidates.find((place) => cityMatches(place, typedCity));
  if (match) return { status: "ok", place: placeLabel(match) };

  const resolved = placeLabel(places[0]);
  const typed = [typedCity, typedState].filter(Boolean).join(", ");
  return {
    status: "blocked",
    message: `${code} is ${resolved.city}, ${resolved.state} — not ${typed}. Fix the address so your order isn't returned to sender.`,
    suggestion: resolved,
  };
}
