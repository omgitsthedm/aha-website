import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown> & { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, ...rest }: Record<string, unknown> & { src: string; alt: string }) =>
    createElement("img", { src, alt, ...rest }),
}));

const [{ CatalogMigrationPage }, { default: CheckoutPage }, { default: CartPage }, { default: HomePage }, { default: LookbookPage }, { default: ContactPage }] = await Promise.all([
  import("@/components/shop/CatalogMigrationPage"),
  import("@/app/checkout/page"),
  import("@/app/cart/page"),
  import("@/app/page"),
  import("@/app/lookbook/page"),
  import("@/app/contact/page"),
]);

describe("catalog outage customer surface", () => {
  it("keeps the shop on a truthful support-and-updates page", () => {
    const markup = renderToStaticMarkup(createElement(CatalogMigrationPage));
    expect(markup).toContain("Shop temporarily unavailable");
    expect(markup).toContain('href="/#dispatch-heading"');
    expect(markup).toContain('href="/contact"');
    expect(markup).not.toContain("next release");
  });

  it("closes checkout before any payment component can render", async () => {
    const markup = renderToStaticMarkup(await CheckoutPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain("Checkout is paused");
    expect(markup).not.toContain("Pay now");
    expect(markup).not.toContain("next release");
  });

  it("keeps noncommerce routes available and removes product, cart, and shop entries", async () => {
    const home = renderToStaticMarkup(await HomePage());
    const lookbook = renderToStaticMarkup(createElement(LookbookPage));
    const cart = renderToStaticMarkup(createElement(CartPage));
    const contact = renderToStaticMarkup(createElement(ContactPage));
    expect(home).toContain("Stay in the loop");
    expect(home).toContain('href="#dispatch-heading"');
    expect(home).not.toContain('href="/product/');
    expect(home).not.toContain("next release");
    expect(lookbook).not.toContain('href="/product/');
    expect(lookbook).toContain('href="/#dispatch-heading"');
    expect(cart).toContain("Shop temporarily unavailable");
    expect(cart).not.toContain("Your bag");
    expect(contact).toContain("info@afterhoursagenda.com");
  });
});
