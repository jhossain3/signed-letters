# Paddle sandbox/live environment switch

Make `PADDLE_ENVIRONMENT` (`sandbox` | `production`) the single switch that selects between two parallel sets of Paddle credentials in all edge functions.

## 1. Secret changes (Lovable Cloud)

Rename existing sandbox secrets (delete old + add new with same value):
- `PADDLE_CLIENT_TOKEN` → `PADDLE_CLIENT_TOKEN_SANDBOX`
- `PADDLE_API_KEY` → `PADDLE_API_KEY_SANDBOX` *(note: `PADDLE_API_KEY` is not currently set in this project — will skip if absent)*
- `PADDLE_PRICE_ID` → `PADDLE_PRICE_ID_SANDBOX`
- `PADDLE_WEBHOOK_SECRET` → `PADDLE_WEBHOOK_SECRET_SANDBOX`

Then prompt you one-by-one for and add:
- `PADDLE_CLIENT_TOKEN_LIVE`
- `PADDLE_API_KEY_LIVE`
- `PADDLE_PRICE_ID_LIVE`
- `PADDLE_WEBHOOK_SECRET_LIVE`

`PADDLE_ENVIRONMENT` stays as the single switch (values: `sandbox` or `production`). `PADDLE_SELLER_ID` is left untouched — it's the same seller account for both modes. Please confirm if you actually have a separate live seller ID; if so we'll split it too.

## 2. Code changes

Add a small helper at the top of each affected edge function:

```ts
const env = (Deno.env.get("PADDLE_ENVIRONMENT") ?? "sandbox").trim();
const suffix = env === "production" ? "_LIVE" : "_SANDBOX";
const pick = (name: string) => Deno.env.get(`${name}${suffix}`)?.trim();
```

Then resolve credentials via `pick("PADDLE_CLIENT_TOKEN")`, etc.

Files updated:
- `supabase/functions/paddle-config/index.ts` — read `PADDLE_CLIENT_TOKEN_{SANDBOX|LIVE}` and `PADDLE_PRICE_ID_{SANDBOX|LIVE}`; still return `environment` to the client so Paddle.js picks the right runtime.
- `supabase/functions/paddle-webhook/index.ts` — read `PADDLE_WEBHOOK_SECRET_{SANDBOX|LIVE}` for signature verification.
- `supabase/functions/complete-physical-order/index.ts` — read `PADDLE_API_KEY_{SANDBOX|LIVE}` and continue to pick `api.paddle.com` vs `sandbox-api.paddle.com` from `PADDLE_ENVIRONMENT`.

No frontend changes (`usePaddle.ts` already gets `environment` from `paddle-config`). No DB, RLS, UI, encryption, or Vault changes.

## 3. Deploy & verify

- Redeploy `paddle-config`, `paddle-webhook`, `complete-physical-order`.
- With `PADDLE_ENVIRONMENT=sandbox`: confirm checkout still loads and a sandbox test transaction flips `physical_letters.payment_status` to `paid`.
- Flip `PADDLE_ENVIRONMENT=production` only after you confirm all four `_LIVE` secrets are set and the live webhook endpoint is registered in Paddle's live dashboard pointing at the same `/functions/v1/paddle-webhook` URL.

## Open questions before I start

1. Confirm you want me to delete the un-suffixed secrets after copying them to `_SANDBOX` (vs. leaving them in place as duplicates).
2. Confirm `PADDLE_SELLER_ID` is shared across sandbox and live (most setups: no — sandbox and live have different seller IDs). If different, I'll add `PADDLE_SELLER_ID_SANDBOX`/`_LIVE` too.
