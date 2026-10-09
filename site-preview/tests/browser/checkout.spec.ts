import { test, expect } from "@playwright/test";
const fixture = {
  slug: "local-test",
  title: "Local test only",
  status: "approved",
  images: [],
  variants: [
    {
      id: "TEST-M",
      squareVariationId: "SQ-TEST",
      price: 5000,
      available: 3,
      size: "M",
      color: "Black",
    },
  ],
};
test("checkout reviews the total, preserves apartment details and locks a pending payment", async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), "Payment simulation is local only.");
  await page.addInitScript(() =>
    localStorage.setItem(
      "aha:bag:v2",
      JSON.stringify([{ id: "TEST-M", quantity: 1 }]),
    ),
  );
  await page.route("**/checkout/", async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const headers = { ...response.headers() };
    delete headers["content-security-policy"];
    delete headers["content-length"];
    delete headers["content-encoding"];
    await route.fulfill({
      response,
      headers,
      body: html.replace(
        /(<script[^>]*id="shopping-data"[^>]*>)[\s\S]*?(<\/script>)/,
        (_, start, end) => start + JSON.stringify([fixture]) + end,
      ),
    });
  });
  await page.route("**/api/commerce", (route) =>
    route.fulfill({
      json: {
        ready: true,
        applicationId: "LOCAL-ONLY",
        locationId: "LOCAL-ONLY",
        sdkUrl: "https://web.squarecdn.com/v1/square.js",
      },
    }),
  );
  await page.route("https://web.squarecdn.com/v1/square.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'window.Square={payments:()=>({card:async()=>({attach:async(selector)=>{document.querySelector(selector).append(document.createElement("iframe"))},tokenize:async()=>({status:"OK",token:"LOCAL-ONLY"}),destroy:async()=>{}})})}',
    }),
  );
  let quoteRequests = 0,
    payments = 0;
  await page.route("**/api/checkout-quote", (route) => {
    quoteRequests++;
    expect(
      route.request().postDataJSON().contact.shippingAddress.address2,
    ).toBe("Unit 7");
    return route.fulfill(
      quoteRequests === 1
        ? { status: 503, json: { error: "Local pricing unavailable" } }
        : {
            json: {
              quote: { subtotal: 5000, tax: 405, total: 5405, currency: "USD" },
            },
          },
    );
  });
  await page.route("**/api/create-payment", (route) => {
    payments++;
    const input = route.request().postDataJSON();
    expect(input.quotedTotal).toBe(5405);
    expect(input.contact.shippingAddress.address2).toBe("Unit 7");
    expect(input.sourceId).toBe("LOCAL-ONLY");
    expect(input.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
    return route.fulfill({
      status: 202,
      json: { ok: true, pending: true, orderNumber: "AHA-LOCAL-ONLY" },
    });
  });
  await page.goto("/checkout/");
  await expect(page.locator("#checkout-form")).toBeVisible();
  for (const [id, value] of Object.entries({
    "checkout-name": "Review Tester",
    "checkout-email": "review@example.com",
    "checkout-address": "1 Test Road",
    "checkout-address2": "Unit 7",
    "checkout-city": "New York",
    "checkout-state-input": "NY",
    "checkout-zip": "10001",
  }))
    await page.locator("#" + id).fill(value);
  await page.getByRole("button", { name: "Review final total" }).click();
  await expect(page.locator("#payment-status")).toContainText(
    "Local pricing unavailable",
  );
  await expect(page.locator("#checkout-address2")).toHaveValue("Unit 7");
  await page.getByRole("button", { name: "Review final total" }).click();
  await expect(page.locator("#quote-total")).toHaveText("Total $54.05");
  await page.getByRole("button", { name: "Pay securely" }).click();
  await expect(page.locator("#payment-status")).toContainText(
    "Confirm that you reviewed",
  );
  expect(payments).toBe(0);
  await page.locator("#accept-order").check();
  await page.getByRole("button", { name: "Pay securely" }).click();
  await expect(page.locator("#payment-status")).toContainText(
    "awaiting confirmation",
  );
  await expect(
    page.getByRole("button", { name: "Pay securely" }),
  ).toBeDisabled();
  expect(payments).toBe(1);
  await page.getByRole("button", { name: "Edit shipping" }).click();
  await expect(page.locator("#payment-status")).toContainText("pending");
  await expect(page.locator("#checkout-name")).toBeDisabled();
});
