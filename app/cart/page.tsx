import { CatalogMigrationPage } from "@/components/shop/CatalogMigrationPage";
import { CartPageContent } from "@/components/cart/CartPageContent";
import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { isStorefrontPublic } from "@/lib/commerce/catalog-policy";

export const metadata = {
  title: "Your Bag",
  description: "Your saved bag is unavailable while the After Hours Agenda shop is temporarily unavailable.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  if (!isStorefrontPublic()) return <CatalogMigrationPage />;
  return <CartPageContent squareConfig={getSquareWebPaymentsConfig()} />;
}
