# Minsk preview deployment

The Minsk functional preview is deployed at https://minsk-web-preview.pages.dev. Its Worker is at https://minsk-api-preview.judithorluchee.workers.dev. On October 30, 2026, the frontend, Worker health endpoint, and budget endpoint returned HTTP 200. Desktop and mobile Playwright journeys passed against the public URL. The previous frontend preview belongs to the rejected design.

The Worker configuration is `apps/api/wrangler.preview.jsonc`. It disables Meta and Baseten inference and allows the Pages origin. The budget endpoint confirmed `liveModelEnabled: false` and `openWeightEnabled: false`. The Worker has a Durable Object budget binding, but no model secret is required for deterministic preview routes.

Build and deploy only from a validated commit on the authorized Cloudflare account. Build the frontend with `VITE_API_URL` set to the verified Worker URL, then deploy `apps/web/dist` to the `minsk-web-preview` Pages project. Verify `/healthz`, `/api/v1/samples`, baseline evaluation, intervention, safeguard, certificate, and benchmark through the deployed browser interface. Keep existing Cloudflare resources until retirement is authorized.

The existing Cloudflare account has a paid Workers plan. The owner authorized use within its current budget. The application ledger does not cap Cloudflare charges. Public model calls remain disabled on the preview.

Public model calls require both the existing provider switches and explicit `PUBLIC_JUDGE_MAX_CALLS` and `PUBLIC_JUDGE_MAX_MICRO_USD` Worker settings. Without both public limits, the budget ledger rejects judge dispatches. Every reservation counts against one persistent global public ceiling across Meta and Baseten, plus per-session and per-IP daily limits. These are application dispatch limits, not provider billing guarantees. Keep both settings unset in the preview until the owner approves a specific public budget and activation plan. The controlled historical evaluation session remains separate.
