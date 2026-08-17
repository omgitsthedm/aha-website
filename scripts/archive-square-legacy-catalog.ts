/*
 * Archives only the 118 frozen legacy ITEM records in
 * docs/square-catalog-archive-candidates-2026-08-16.json.
 *
 * Default: read-only preflight and dry run.
 * Apply:   npm run archive:square-legacy -- --apply
 *
 * Square archive guidance (verified 2026-08-16):
 * https://developer.squareup.com/docs/catalog-api/archive-catalog-items
 * https://developer.squareup.com/reference/square/catalog-api/UpsertCatalogObject
 */
import { randomUUID } from "node:crypto";
import snapshotJson from "../docs/square-catalog-archive-candidates-2026-08-16.json";
import {
  SQUARE_ARCHIVE_API_VERSION,
  type ArchiveSnapshot,
  type SquareCatalogItem,
  buildArchivePlan,
  buildArchivedCatalogObject,
  validateArchiveResponse,
  validateExactCandidate,
  validatePostflightCatalog,
  validatePreflightCatalog,
} from "./lib/square-catalog-archive";

const snapshot = snapshotJson as ArchiveSnapshot;
const args = process.argv.slice(2);
const apply = args.length === 1 && args[0] === "--apply";

if (args.length > 0 && !apply) {
  throw new Error("Usage: npm run archive:square-legacy [-- --apply]");
}

type SquareResponse = { objects?: SquareCatalogItem[]; cursor?: string };
type RetrieveResponse = { object?: SquareCatalogItem };
type UpsertResponse = { catalog_object?: SquareCatalogItem };

function getAccessToken(): string {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is required; no request was sent.");
  return token;
}

async function squareRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let lastFailure = "no response";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://connect.squareup.com/v2${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_ARCHIVE_API_VERSION,
        ...init.headers,
      },
      cache: "no-store",
    });
    const responseText = await response.text();
    if (response.ok) return JSON.parse(responseText) as T;

    lastFailure = `Square ${init.method ?? "GET"} ${path} failed (${response.status}): ${responseText.slice(0, 1_000)}`;
    // Square serializes catalog updates and can temporarily return 429. An
    // upsert uses the same idempotency key/body on retry, so a transient reply
    // cannot produce a second catalog mutation.
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
      continue;
    }
    throw new Error(lastFailure);
  }
  throw new Error(lastFailure);
}

async function listEveryCatalogItem(token: string): Promise<SquareCatalogItem[]> {
  const items: SquareCatalogItem[] = [];
  let cursor: string | undefined;
  do {
    const payload: { object_types: ["ITEM"]; include_deleted_objects: true; limit: number; cursor?: string } = {
      object_types: ["ITEM"],
      include_deleted_objects: true,
      limit: 100,
    };
    if (cursor) payload.cursor = cursor;
    const page = await squareRequest<SquareResponse>(token, "/catalog/search", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    items.push(...(page.objects ?? []));
    cursor = page.cursor;
  } while (cursor);
  return items;
}

async function retrieveExactCandidate(token: string, id: string): Promise<SquareCatalogItem> {
  const result = await squareRequest<RetrieveResponse>(token, `/catalog/object/${encodeURIComponent(id)}`);
  if (!result.object) throw new Error(`Square returned no object for candidate ${id}.`);
  return result.object;
}

async function archiveCandidate(token: string, candidate: ReturnType<typeof buildArchivePlan>["candidates"][number]): Promise<void> {
  // This GET is intentionally immediately adjacent to the archive write; no
  // snapshot object is ever used as the write payload.
  const current = await retrieveExactCandidate(token, candidate.id);
  validateExactCandidate(current, candidate);

  const result = await squareRequest<UpsertResponse>(token, "/catalog/object", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: randomUUID(),
      object: buildArchivedCatalogObject(current),
    }),
  });
  validateArchiveResponse(result.catalog_object, candidate);
}

async function main(): Promise<void> {
  const { candidates, preservedServices } = buildArchivePlan(snapshot);
  const token = getAccessToken();

  // This whole-catalog read catches target drift, the two protected services
  // being targeted, and any active product introduced after the frozen snapshot.
  const catalog = await listEveryCatalogItem(token);
  const { outstandingCandidates, alreadyArchivedCandidates } = validatePreflightCatalog(snapshot, catalog);

  const mode = apply ? "APPLY" : "DRY RUN";
  console.log(`${mode}: ${candidates.length} legacy Square ITEMs validated (${alreadyArchivedCandidates.length} already archived, ${outstandingCandidates.length} outstanding); ${preservedServices.length} service ITEMs protected.`);
  console.log(`Already archived targets (${alreadyArchivedCandidates.length}):`);
  for (const candidate of alreadyArchivedCandidates) {
    console.log(`  ${candidate.id}\t${candidate.name}`);
  }
  console.log(`Outstanding archive writes (${outstandingCandidates.length}):`);
  for (const candidate of outstandingCandidates) {
    console.log(`  ${candidate.id}\t${candidate.name}`);
  }
  if (!apply) {
    console.log("No Square catalog changes were made. Re-run with --apply only after review.");
    return;
  }

  for (const [index, candidate] of outstandingCandidates.entries()) {
    await archiveCandidate(token, candidate);
    console.log(`Archived ${index + 1}/${outstandingCandidates.length} outstanding: ${candidate.id} (${candidate.name})`);
  }

  const postflightCatalog = await listEveryCatalogItem(token);
  validatePostflightCatalog(snapshot, postflightCatalog);
  console.log(`Complete: postflight proved ${candidates.length} legacy Square ITEMs archived and ${preservedServices.length} service ITEMs still active. Orders, payments, customers, images, and catalog history were not deleted.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
