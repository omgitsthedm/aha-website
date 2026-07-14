// Square Customers — every paid order links to a Customer profile so the
// Square dashboard doubles as the brand's CRM (order history, repeat buyers,
// receipts). Strictly best-effort: a CRM failure must never block a payment.
import { squareRequest } from "@/lib/square/client";

interface SquareCustomer { id: string; email_address?: string }

/**
 * Find a customer by exact email or create one. Returns null on any failure —
 * callers treat the id as optional enrichment.
 */
export async function findOrCreateCustomer(
  email: string,
  name?: string
): Promise<string | null> {
  try {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;

    const search = await squareRequest<{ customers?: SquareCustomer[] }>("/customers/search", {
      method: "POST",
      revalidate: 0,
      body: { query: { filter: { email_address: { exact: normalized } } }, limit: 1 },
    });
    if (search.customers?.[0]?.id) return search.customers[0].id;

    const [givenName, ...rest] = (name || "").trim().split(/\s+/);
    const created = await squareRequest<{ customer?: SquareCustomer }>("/customers", {
      method: "POST",
      revalidate: 0,
      body: {
        idempotency_key: `cust-${normalized}`,
        email_address: normalized,
        ...(givenName ? { given_name: givenName } : {}),
        ...(rest.length ? { family_name: rest.join(" ") } : {}),
        note: "Created automatically from afterhoursagenda.com checkout.",
      },
    });
    return created.customer?.id ?? null;
  } catch {
    return null;
  }
}
