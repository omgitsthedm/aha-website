import { NextResponse } from "next/server";

// Bake Netlify's COMMIT_REF into the artifact during the build so the endpoint
// remains authoritative even when build-only metadata is absent at runtime.
export const dynamic = "force-static";

/**
 * Public, non-secret release identity used to prove that verification is
 * running against the exact Netlify artifact for a commit.
 */
export function GET() {
  const commit =
    process.env.COMMIT_REF?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    "local";

  return NextResponse.json(
    {
      schemaVersion: 1,
      site: "afterhoursagenda.com",
      source: "omgitsthedm/aha-website",
      commit,
      context: process.env.CONTEXT?.trim() || "local",
      branch: process.env.BRANCH?.trim() || "local",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
