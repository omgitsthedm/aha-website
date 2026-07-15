# Lifecycle Email — Abandoned-Cart Recovery (Wave 2)

> Status: **built, shipped, gated OFF.** No customer receives anything until
> `LIFECYCLE_EMAIL_ENABLED=true`. Separate from transactional order email (which
> is always on and unaffected).

## What it does
When a shopper enters a valid email at `/checkout` but doesn't finish, we save a
snapshot (`abandoned_carts` table). An hourly Netlify scheduled function pings a
secret-gated route that, after a 1-hour delay (and within 3 days), sends **one**
recovery email — unless they've since placed an order (auto-suppressed) or
unsubscribed. One-click unsubscribe + physical address are included (CAN-SPAM).

## Pieces
- `abandoned_carts` table (migration `20260715063811_tearful_firebird`).
- Capture: `POST /api/checkout/capture` (fire-and-forget from checkout; never blocks the purchase flow).
- Dispatch: `lib/commerce/abandoned-cart.ts#dispatchAbandonedCarts` → `POST /api/cron/lifecycle` (secret-gated).
- Scheduler: `netlify/functions/lifecycle-cron.mts` (`@hourly`).
- Email: `lib/email/marketing-templates.ts` + `lib/email/marketing.ts` (unsubscribe headers).
- Unsubscribe: `GET/POST /api/lifecycle/unsubscribe?email=&t=` (HMAC-token verified).
- Test send: `POST /api/ops/lifecycle-test` (ops-auth) → sample email to support address.

## Safety
- **Gate:** sends only when `LIFECYCLE_EMAIL_ENABLED=true`. Otherwise the dispatcher
  **dry-runs** (counts what it *would* send, sends nothing, leaves rows un-notified),
  so scheduling it before launch is harmless.
- **Capture** swallows all errors and always 200s — it cannot affect checkout.
- **Suppression:** any order for that email placed after the cart is captured cancels the send.
- **Idempotent:** one email per cart (`idempotencyKey = abandoned:<id>`).

## Env vars (set in Netlify) — human step
| Var | Purpose | Required |
|---|---|---|
| `CRON_SECRET` | Auth for the cron route + scheduled function | Yes (dispatch is 404 without it) |
| `LIFECYCLE_EMAIL_ENABLED` | `true` to send to real customers | No (default: off / dry-run) |
| `LIFECYCLE_SECRET` | HMAC key for unsubscribe tokens (falls back to `CRON_SECRET`) | No |
| `MAILING_ADDRESS` | Real postal address for CAN-SPAM footer | **Yes before go-live** |
| `SITE_URL` | Canonical origin for links (falls back to Netlify `URL`) | No |

(`RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `RESEND_REPLY_TO` already set — transactional email is live.)

## Go-live checklist (David)
1. Set `CRON_SECRET` (random string) + `MAILING_ADDRESS` (real address) in Netlify.
2. Deploy. The scheduler runs hourly, dry-running (no sends yet).
3. Log into `/ops`, trigger a **test send** (`POST /api/ops/lifecycle-test`) → confirm the email looks right in your inbox.
4. When happy, set `LIFECYCLE_EMAIL_ENABLED=true`. Recovery emails now go live.
5. To pause anytime: set it back to `false` (or unset).

## Now included (same gate + scheduler + sender)
- **Welcome series** — Netlify Forms `submission-created` → `/api/newsletter/welcome`
  records the subscriber and sends one welcome (gated). Fires on the newsletter form.
- **Post-purchase review-request** — `lib/commerce/review-request.ts`, run by the
  hourly cron. One email per order, 7+ days after it ships, deep-linked to the
  product's review form. Deduped via `review_request_log`; honors unsubscribe.

All three flows dry-run until `LIFECYCLE_EMAIL_ENABLED=true`. Unsubscribe is a
global suppression list (any lifecycle email honors it).

## Follow-ups (same infra)
Win-back (lapsed buyers) and one-tap reorder — small adds on this foundation.
