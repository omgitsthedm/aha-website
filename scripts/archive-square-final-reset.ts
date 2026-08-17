/*
 * Archives the two exact Square Online service ITEMs that the original
 * 118-item legacy archive intentionally preserved. It does not alter that
 * frozen workflow or target arbitrary Square account objects.
 *
 * Default: read-only preflight and dry run.
 * Apply:   npm run archive:square-final-reset -- --apply
 */
import { randomUUID } from "node:crypto";
import snapshotJson from "../docs/square-catalog-archive-candidates-2026-08-16.json";
import {
  SQUARE_ARCHIVE_API_VERSION,
  type ArchiveSnapshot,
  type PreservedService,
  type SquareCatalogItem,
  buildArchivedCatalogObject,
} from "./lib/square-catalog-archive";
import {
  validateExactFinalResetService,
  validateFinalResetArchiveResponse,
  validateFinalResetPostflight,
  validateFinalResetPreflight,
} from "./lib/square-catalog-final-reset";

const snapshot = snapshotJson as ArchiveSnapshot;
const args = process.argv.slice(2);
const apply = args.length === 1 && args[0] === "--apply";

if (args.length > 0 && !apply) {
  throw new Error("Usage: npm run archive:square-final-reset [-- --apply]");
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
    if (response.ok) return response.json() as Promise<T>;

    lastFailure = `Square ${init.method ?? "GET"} ${path} failed (${response.status}).`;
    // Square serializes catalog updates. The same body and idempotency key are
    // retained for a retry, so a transient result cannot repeat the mutation.
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

async function retrieveExactService(token: string, id: string): Promise<SquareCatalogItem> {
  const result = await squareRequest<RetrieveResponse>(token, `/catalog/object/${encodeURIComponent(id)}`);
  if (!result.object) throw new Error(`Square returned no object for final-reset service ${id}.`);
  return result.object;
}

async function archiveService(token: string, service: PreservedService): Promise<void> {
  // A just-in-time retrieve protects the full-replacement upsert from stale
  // data. The final reset never writes a copy from the frozen snapshot.
  const current = await retrieveExactService(token, service.id);
  validateExactFinalResetService(current, service);

  const result = await squareRequest<UpsertResponse>(token, "/catalog/object", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: randomUUID(),
      object: buildArchivedCatalogObject(current),
    }),
  });
  validateFinalResetArchiveResponse(result.catalog_object, service);
}

async function main(): Promise<void> {
  const token = getAccessToken();
  const catalog = await listEveryCatalogItem(token);
  const { outstandingServices, alreadyArchivedServices } = validateFinalResetPreflight(snapshot, catalog);
  const mode = apply ? "APPLY" : "DRY RUN";

  console.log(`${mode}: the original 118-item archive is complete; ${alreadyArchivedServices.length} final service ITEM(s) already archived, ${outstandingServices.length} outstanding.`);
  console.log(`Already archived final services (${alreadyArchivedServices.length}):`);
  for (const service of alreadyArchivedServices) {
    console.log(`  ${service.id}\t${service.name}`);
  }
  console.log(`Outstanding final archive writes (${outstandingServices.length}):`);
  for (const service of outstandingServices) {
    console.log(`  ${service.id}\t${service.name}`);
  }
  if (!apply) {
    console.log("No Square catalog changes were made. Re-run with --apply only after review.");
    return;
  }

  for (const [index, service] of outstandingServices.entries()) {
    await archiveService(token, service);
    console.log(`Archived ${index + 1}/${outstandingServices.length} outstanding final service: ${service.id} (${service.name})`);
  }

  const postflightCatalog = await listEveryCatalogItem(token);
  validateFinalResetPostflight(snapshot, postflightCatalog);
  console.log("Complete: postflight proved all 120 known Square ITEMs archived and zero active ITEMs. Orders, payments, customers, images, and catalog history were not deleted.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
