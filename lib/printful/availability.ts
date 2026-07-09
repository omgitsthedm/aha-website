// Live Printful stock. Reads catalog-variant availability directly from Printful (5-min fresh via
// Next fetch cache; the catalog-stock webhook can revalidate sooner). Fails OPEN (shows in-stock) if
// the API is unreachable — print-on-demand blanks are rarely out, and a paid order still becomes a draft.
const BASE = process.env.PRINTFUL_API_BASE_URL || "https://api.printful.com/v2";

interface AvailabilityResponse {
  data?: { techniques?: Array<{ selling_regions?: Array<{ availability?: string }> }> };
}

export async function getVariantInStock(catalogVariantId: number): Promise<boolean> {
  const token = process.env.PRINTFUL_API_TOKEN;
  const store = process.env.PRINTFUL_STORE_ID;
  if (!token || !catalogVariantId) return true;
  try {
    const res = await fetch(`${BASE}/catalog-variants/${catalogVariantId}/availability`, {
      headers: { Authorization: `Bearer ${token}`, ...(store ? { "X-PF-Store-Id": store } : {}) },
      next: { revalidate: 300 },
    });
    if (!res.ok) return true;
    const d = (await res.json()) as AvailabilityResponse;
    const techniques = d.data?.techniques ?? [];
    return techniques.some((t) =>
      (t.selling_regions ?? []).some((r) => String(r.availability ?? "").toLowerCase().includes("in stock"))
    );
  } catch {
    return true;
  }
}
