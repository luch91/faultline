# Minsk preview deployment

The Minsk-named preview has not yet been deployed or verified. The previous frontend preview belongs to the rejected design and must not be presented as this branch.

The proposed Worker configuration is `apps/api/wrangler.preview.jsonc`. It disables Meta and Baseten inference. Its `ALLOWED_ORIGIN` must match the actual Pages deployment URL before public testing. The Worker has a Durable Object budget binding, but no model secret is required for deterministic preview routes.

Build and deploy only from a validated commit on the authorized Cloudflare account. Create the `minsk-web-preview` Pages project if it does not exist, then configure `VITE_API_URL` to the verified Worker URL. Verify `/healthz`, `/api/v1/samples`, baseline evaluation, intervention, safeguard, certificate, and benchmark through the deployed browser interface. Keep existing Cloudflare resources until the replacement is verified and retirement is authorized.

The existing Cloudflare account has a paid Workers plan. The owner authorized use within its current budget. The application ledger does not cap Cloudflare charges. Public model calls remain disabled on the preview.
