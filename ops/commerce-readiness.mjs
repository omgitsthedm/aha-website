#!/usr/bin/env node
// Current production, read-only. Uses AHA_COMMERCE_MONITOR_TOKEN, not provider
// credentials or historical Printful/Next.js environment flags.
await import("../site-preview/scripts/check-commerce-live.mjs");
