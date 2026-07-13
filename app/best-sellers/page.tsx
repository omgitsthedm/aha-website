import { permanentRedirect } from "next/navigation";

export default function BestSellersRedirect() {
  permanentRedirect("/catalog-edit");
}
