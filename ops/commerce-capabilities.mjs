#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TARGET_SITE_ID = "275b4115-16bf-42fb-9b36-6bce9bb93608";

function netlifyEnv(name) {
  const result = spawnSync("netlify", [
    "env:get", name, "--site", TARGET_SITE_ID, "--context", "production",
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Could not read ${name} from Netlify.`);
  return result.stdout.trim();
}

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

function firstActiveSquareVariation() {
  const manifest = JSON.parse(readFileSync("data/product-manifest.json", "utf8"));
  const squareMap = JSON.parse(readFileSync("data/square-map.json", "utf8")).map ?? {};
  for (const product of manifest.products ?? []) {
    if (product.status !== "active") continue;
    const variant = (product.variants ?? []).find((item) =>
      item.status === "active" && squareMap[item.ahaVariantId]?.squareVariationId
    );
    if (variant) return squareMap[variant.ahaVariantId].squareVariationId;
  }
  throw new Error("No active Square variation is available for the capability probe.");
}

async function main() {
  const token = netlifyEnv("SQUARE_ACCESS_TOKEN");
  const apiVersion = netlifyEnv("SQUARE_API_VERSION") || "2024-01-18";
  const locationId = netlifyEnv("SQUARE_LOCATION_ID");
  const expectedWebhookUrl = netlifyEnv("SQUARE_WEBHOOK_NOTIFICATION_URL");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Square-Version": apiVersion,
    "Content-Type": "application/json",
  };

  console.log("AHA commerce capability probe (read/calculate only; no records created)");
  console.log(`site=${TARGET_SITE_ID}`);

  const locations = await jsonRequest("https://connect.squareup.com/v2/locations", { headers });
  console.log(`${locations.response.ok ? "OK" : "FAIL"} Square Locations read (${locations.response.status})`);

  const variationId = firstActiveSquareVariation();
  const calculated = await jsonRequest("https://connect.squareup.com/v2/orders/calculate", {
    method: "POST",
    headers,
    body: JSON.stringify({
      order: {
        location_id: locationId,
        pricing_options: { auto_apply_taxes: true },
        line_items: [{ catalog_object_id: variationId, quantity: "1" }],
        fulfillments: [{
          type: "SHIPMENT", state: "PROPOSED",
          shipment_details: { recipient: {
            display_name: "Capability Probe",
            address: {
              address_line_1: "350 5th Ave", locality: "New York",
              administrative_district_level_1: "NY", postal_code: "10118", country: "US",
            },
          } },
        }],
      },
    }),
  });
  console.log(`${calculated.response.ok ? "OK" : "FAIL"} Square Orders calculate (${calculated.response.status})`);

  const subscriptions = await jsonRequest("https://connect.squareup.com/v2/webhooks/subscriptions", { headers });
  const ahaSubscription = (subscriptions.json.subscriptions ?? []).find((item) => item.name === "AHA Netlify Square Webhook");
  const actualWebhookUrl = ahaSubscription?.notification_url ?? "missing";
  const webhookMatches = actualWebhookUrl === expectedWebhookUrl;
  console.log(`${webhookMatches ? "OK" : "FAIL"} Square webhook URL exact match`);
  console.log(`  Square=${actualWebhookUrl}`);
  console.log(`  Netlify=${expectedWebhookUrl}`);

  const printfulToken = netlifyEnv("PRINTFUL_API_TOKEN");
  const printfulStoreId = netlifyEnv("PRINTFUL_STORE_ID");
  const printful = await jsonRequest("https://api.printful.com/v2/stores", {
    headers: { Authorization: `Bearer ${printfulToken}`, "X-PF-Store-Id": printfulStoreId },
  });
  const printfulStorePresent = printful.response.ok && (printful.json.data ?? []).some(
    (store) => String(store.id) === String(printfulStoreId)
  );
  console.log(`${printfulStorePresent ? "OK" : "FAIL"} Printful configured store read (${printful.response.status})`);

  if (!locations.response.ok || !calculated.response.ok || !webhookMatches || !printfulStorePresent) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
