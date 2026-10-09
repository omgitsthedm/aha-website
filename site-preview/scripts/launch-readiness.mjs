import {
  launch,
  approvedPieces,
  validateCatalog,
} from "../src/data/catalog.ts";
import { readFile } from "node:fs/promises";
const legacy = await readFile(
  new URL("../../lib/commerce/catalog-policy.ts", import.meta.url),
  "utf8",
);
const gates = [
  {
    name: "Current collection approved",
    passed: launch.releaseApproved === true,
  },
  {
    name: "Shipping and return policies approved",
    passed: launch.policyApproved === true,
  },
  {
    name: "Dated release decision recorded",
    passed:
      typeof launch.approvedOn === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(launch.approvedOn),
  },
  { name: "At least one approved product", passed: approvedPieces.length > 0 },
  {
    name: "Product specifications, labels, QC, sizes and variants valid",
    passed: validateCatalog(approvedPieces, true).length === 0,
  },
  {
    name: "Preserved Apliiq checkout gate open",
    passed: /APLIIQ_CATALOG_POLICY[\s\S]*?checkoutEnabled:\s*true/.test(legacy),
  },
];
console.log(
  JSON.stringify(
    {
      status: gates.every((g) => g.passed)
        ? "source-ready-provider-verification-required"
        : "closed",
      products: approvedPieces.length,
      gates,
      errors: validateCatalog(approvedPieces, true),
      externalProofRequired: [
        "Current Square catalog prices and active location",
        "Apliiq approved garment, decoration, label, SKU and delivery evidence",
        "Authenticated provider and email-domain health",
        "Exact database binding and additive migration release",
        "End-to-end sandbox receipt and operational support coverage",
        "Separate production release authorization",
      ],
    },
    null,
    2,
  ),
);
process.exitCode = gates.every((g) => g.passed) ? 0 : 2;
