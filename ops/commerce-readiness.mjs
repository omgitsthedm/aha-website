#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TARGET_SITE_ID = "275b4115-16bf-42fb-9b36-6bce9bb93608";

const REQUIRED = {
  square: [
    "SQUARE_ACCESS_TOKEN",
    "SQUARE_APPLICATION_ID",
    "SQUARE_ENVIRONMENT",
    "SQUARE_API_VERSION",
    "SQUARE_LOCATION_ID",
    "SQUARE_WEBHOOK_SIGNATURE_KEY",
    "SQUARE_WEBHOOK_NOTIFICATION_URL",
  ],
  printful: [
    "PRINTFUL_API_TOKEN",
    "PRINTFUL_STORE_ID",
    "PRINTFUL_WEBHOOK_SECRET_KEY",
    "PRINTFUL_WEBHOOK_PUBLIC_KEY",
  ],
  netlify: [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SQUARE_APP_ID",
    "AHA_FULFILLMENT_MODE",
    "AHA_READINESS_TOKEN",
  ],
};

function flattenGroups(groups) {
  return [...new Set(Object.values(groups).flat())];
}

function localPresence(names) {
  return Object.fromEntries(names.map((name) => [name, Boolean(process.env[name])]));
}

function printGroup(title, presence, names) {
  console.log(`\n${title}`);
  for (const name of names) {
    console.log(`  ${presence[name] ? "OK     " : "MISSING"} ${name}`);
  }
}

function runNetlifyEnvList(context) {
  const result = spawnSync(
    "netlify",
    [
      "env:list",
      "--site",
      TARGET_SITE_ID,
      "--context",
      context,
      "--json",
    ],
    { encoding: "utf8" }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "netlify env:list failed");
  }

  const parsed = JSON.parse(result.stdout || "{}");
  return Object.fromEntries(
    flattenGroups(REQUIRED).map((name) => [
      name,
      Object.prototype.hasOwnProperty.call(parsed, name),
    ])
  );
}

function committedNetlifyTomlPresence(names) {
  let contents = "";
  try {
    contents = readFileSync("netlify.toml", "utf8");
  } catch {
    return {};
  }

  return Object.fromEntries(
    names.map((name) => [
      name,
      new RegExp(`(^|\\n)\\s*${name}\\s*=`, "m").test(contents),
    ])
  );
}

function main() {
  const mode = process.argv.includes("--netlify") ? "netlify" : "local";
  const contextArgIndex = process.argv.indexOf("--context");
  const context =
    contextArgIndex >= 0 ? process.argv[contextArgIndex + 1] : "production";
  const requiredNames = flattenGroups(REQUIRED);

  console.log("AHA commerce readiness");
  console.log(`mode=${mode}`);
  if (mode === "netlify") {
    console.log(`site=${TARGET_SITE_ID}`);
    console.log(`context=${context}`);
  }

  const sitePresence =
    mode === "netlify" ? runNetlifyEnvList(context) : localPresence(requiredNames);
  const committedPresence =
    mode === "netlify" ? committedNetlifyTomlPresence(requiredNames) : {};
  const presence = Object.fromEntries(
    requiredNames.map((name) => [
      name,
      Boolean(sitePresence[name] || committedPresence[name]),
    ])
  );

  printGroup("Square", presence, REQUIRED.square);
  printGroup("Printful", presence, REQUIRED.printful);
  printGroup("Netlify/runtime", presence, REQUIRED.netlify);

  const missing = requiredNames.filter((name) => !presence[name]);
  if (missing.length) {
    console.log(`\nMissing ${missing.length} required readiness vars.`);
    process.exitCode = 1;
    return;
  }

  console.log("\nCommerce readiness env names are present. Values were not printed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
