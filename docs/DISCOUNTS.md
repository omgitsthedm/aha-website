# Discounts / Promo Codes

The store has a promo-code discount engine. **Adding, changing, or removing a
promo is done entirely with Netlify environment variables — no code change, no
deploy of new code.** Change the vars, redeploy (or trigger a rebuild), done.

## How it works (all services stay in sync)

1. Shopper enters a code at checkout.
2. The server (never the client) resolves the code from env and computes the
   discount **from the cart**.
3. The discount is applied to the **Square order** (order-level). Square
   recomputes the total and tax on the discounted subtotal.
4. The charge is taken against that discounted Square order, so **Square records
   the discount, the customer's Square receipt shows it**, and the amount charged
   is the discounted total.
5. The `QUOTE_CHANGED` guard re-resolves the same code + cart at charge time, so
   the quoted total and the charged total always match (no under/overcharge).
6. The order is persisted with the **gross subtotal + the discount amount**
   (`orders.subtotal_amount`, `orders.discount_amount`), and the **confirmation
   email + order-confirmed page show a Subtotal / Discount / Total breakdown**.
7. Printful fulfillment is unaffected (it's per-item, not price-based).

Code: `lib/commerce/discounts.ts` · `lib/square/orders.ts` (buildSquareOrder) ·
`app/api/checkout-quote` · `app/api/create-payment` · `components/checkout/CheckoutForm.tsx`.
Tests: `tests/unit/discounts.test.ts`.

## Environment variables

| Var | Meaning | Example |
|-----|---------|---------|
| `PROMO_CODE` | The code shoppers type (case-insensitive). **Unset = discounts OFF.** | `OneOnMe` |
| `PROMO_TYPE` | `bogo` (buy 1 get 1 free) or `percent`. Default `percent`. | `bogo` |
| `PROMO_PERCENT` | Percent off (1–99). Only used when `PROMO_TYPE=percent`. | `10` |
| `PROMO_LABEL` | Shown to the shopper + on the receipt/email. | `Buy 1, Get 1 Free` |

- **BOGO** = for every 2 items, the cheaper is free (cart-wide). One item alone
  gets no discount.
- **Percent** = a flat % off the order total.
- Only **one** promo code is active at a time. Rotate the code to control reach.

## Recipes

**Currently live:** `PROMO_CODE=OneOnMe`, `PROMO_TYPE=bogo`, `PROMO_LABEL="Buy 1, Get 1 Free"`.

Set with the Netlify CLI (from `aha-website/`), then redeploy:

```bash
# Buy 1 get 1 free
netlify env:set PROMO_CODE "OneOnMe"
netlify env:set PROMO_TYPE "bogo"
netlify env:set PROMO_LABEL "Buy 1, Get 1 Free"

# OR: 15% off with code SPRING15
netlify env:set PROMO_CODE "SPRING15"
netlify env:set PROMO_TYPE "percent"
netlify env:set PROMO_PERCENT "15"
netlify env:set PROMO_LABEL "Spring 15% off"

# Turn discounts OFF entirely
netlify env:unset PROMO_CODE
```

(Or set the same vars in the Netlify dashboard → Site configuration → Environment
variables.) Changes take effect on the next deploy/rebuild.

## Guardrails

- The percentage / BOGO reduces margin **above** the 35% variant floor — that
  floor governs individual variant *pricing*, not marketing promos. Choosing the
  promo depth is a business decision.
- Anyone with the active code gets the discount. There is no per-customer
  "first order only" enforcement yet (would need an email-history check).
