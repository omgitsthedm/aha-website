// Netlify `ignore` command: exit 0 skips the build, exit 1 builds.
// A commit builds unless every changed file is tooling, tests, catalog source
// data, agent instructions or docs — none of which reach the deployed site or
// functions. When in doubt (no refs, a rebuild of the same commit, a git error)
// it builds.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const NEVER_DEPLOYED = [
  /^site-preview\/tools\//,
  /^site-preview\/tests\//,
  /^site-preview\/catalog\//,
  /^\.agents\//,
  /^\.claude\//,
  /^\.github\//,
  /^reports\//,
  /^research_notes\//,
  /^docs\//,
  /^production-artwork\//,
  /\.md$/,
];

export function needsBuild(files) {
  return files.some((file) => !NEVER_DEPLOYED.some((pattern) => pattern.test(file)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.env.CACHED_COMMIT_REF;
  const head = process.env.COMMIT_REF;
  if (!base || !head || base === head) process.exit(1);
  let files;
  try { files = execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" }).split("\n").filter(Boolean); }
  catch { process.exit(1); }
  const build = needsBuild(files);
  console.log(build ? `Building: ${files.filter((file) => !NEVER_DEPLOYED.some((pattern) => pattern.test(file))).slice(0, 5).join(", ")}` : `Skipping build: ${files.length} changed file(s), none deployed.`);
  process.exit(build ? 1 : 0);
}
