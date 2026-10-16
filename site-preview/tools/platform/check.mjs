// `npm run client:check [file]`: validate a client config (default: this store's).
import { readFileSync } from "node:fs";
import { clientConfigProblems } from "../../server/platform/client.mjs";

const file = process.argv[2] ?? new URL("../../client.config.json", import.meta.url);
let config;
try { config = JSON.parse(readFileSync(file, "utf8")); }
catch (error) { console.log(JSON.stringify({ ok: false, problems: [`Can't read ${file}: ${error.message}`] })); process.exit(1); }
const problems = clientConfigProblems(config);
console.log(JSON.stringify({ ok: problems.length === 0, client: config?.client?.slug ?? null, problems }));
process.exitCode = problems.length ? 1 : 0;
