#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-site}"
EXPECTED_SITE_ID="275b4115-16bf-42fb-9b36-6bce9bb93608"
EXPECTED_SITE_NAME="afterhoursagenda"
EXPECTED_SITE_URL="https://afterhoursagenda.netlify.app"
EXPECTED_ADMIN_URL="https://app.netlify.com/projects/afterhoursagenda"
LIVE_URL="${LIVE_URL:-https://afterhoursagenda.netlify.app/}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

normalize_url() {
  node -e "const value = process.argv[1] || ''; console.log(value.replace(/^http:/, 'https:').replace(/\\/$/, ''))" "$1"
}

require_cmd node
require_cmd netlify

site_json="$(netlify api getSite --data "{\"site_id\":\"${EXPECTED_SITE_ID}\"}")"

SITE_JSON="$site_json" \
EXPECTED_SITE_ID="$EXPECTED_SITE_ID" \
EXPECTED_SITE_NAME="$EXPECTED_SITE_NAME" \
EXPECTED_SITE_URL="$EXPECTED_SITE_URL" \
EXPECTED_ADMIN_URL="$EXPECTED_ADMIN_URL" \
node <<'NODE'
const site = JSON.parse(process.env.SITE_JSON || "{}");
const expected = {
  id: process.env.EXPECTED_SITE_ID,
  name: process.env.EXPECTED_SITE_NAME,
  url: process.env.EXPECTED_SITE_URL,
  adminUrl: process.env.EXPECTED_ADMIN_URL,
};

function normalize(value) {
  return String(value || "").replace(/^http:/, "https:").replace(/\/$/, "");
}

function fail(message) {
  console.error(`Netlify target guard failed: ${message}`);
  process.exit(1);
}

if (site.id !== expected.id && site.site_id !== expected.id) {
  fail(`expected site id ${expected.id}, got ${site.id || site.site_id || "<missing>"}`);
}

if (site.name !== expected.name) {
  fail(`expected site name ${expected.name}, got ${site.name || "<missing>"}`);
}

if (normalize(site.admin_url) !== normalize(expected.adminUrl)) {
  fail(`expected admin url ${expected.adminUrl}, got ${site.admin_url || "<missing>"}`);
}

const possibleUrls = [site.ssl_url, site.url, site.default_domain && `https://${site.default_domain}`]
  .filter(Boolean)
  .map(normalize);

if (!possibleUrls.includes(normalize(expected.url))) {
  fail(`expected live url ${expected.url}, got ${possibleUrls.join(", ") || "<missing>"}`);
}

if (!site.build_settings || Object.keys(site.build_settings).length === 0) {
  console.warn("Netlify target guard warning: site is not Git-linked; use exact --site deploys until Git linking is repaired.");
}

console.log(`Netlify target guard OK: ${expected.name} (${expected.id})`);
NODE

if [[ "$MODE" == "site" ]]; then
  exit 0
fi

if [[ "$MODE" != "live" ]]; then
  echo "Usage: $0 [site|live]" >&2
  exit 1
fi

require_cmd curl

live_html="$(curl -LfsS "$LIVE_URL")"

LIVE_HTML="$live_html" LIVE_URL="$LIVE_URL" node <<'NODE'
const html = process.env.LIVE_HTML || "";
const liveUrl = process.env.LIVE_URL || "";
const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";

function fail(message) {
  console.error(`Netlify live guard failed: ${message}`);
  process.exit(1);
}

if (!/After Hours Agenda/i.test(title) && !/After Hours Agenda/i.test(html)) {
  fail(`expected After Hours Agenda content at ${liveUrl}; title was "${title || "<missing>"}"`);
}

if (/Pole Position IT|Miami Technology Concierge|polepositionit/i.test(html)) {
  fail(`wrong-site Pole Position content is still present at ${liveUrl}`);
}

console.log(`Netlify live guard OK: ${liveUrl} title="${title || "<missing>"}"`);
NODE
