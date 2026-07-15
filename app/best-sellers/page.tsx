import { redirect } from "next/navigation";

// /best-sellers isn't a distinct curated collection yet — send shoppers to the
// full shop, not the internal catalog-edit surface it previously pointed at.
// Uses a temporary redirect (the old permanent one to /catalog-edit may be
// cached in browsers; this is the corrected target going forward).
export default function BestSellersRedirect() {
  redirect("/shop");
}
