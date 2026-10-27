# Staging deployment

The public deterministic preview is at https://faultline-web-preview.pages.dev. The API Worker is at https://faultline-api-preview.judithorluchee.workers.dev. These addresses were verified on October 27, 2026.

The Pages project is a separate direct-upload staging project. Its frontend build sets `VITE_API_URL` to the preview Worker URL. The Worker uses `apps/api/wrangler.preview.jsonc`, whose live model switch and credit confirmation are both false. No Meta key is installed in the preview Worker. The Durable Object binding remains active for request throttling and the budget ledger.

The authorized Cloudflare account is on an existing Workers Paid plan. Cloudflare can charge for usage beyond the plan's included allowances. The preview has no Cloudflare account-level spend cap, so its public availability does not guarantee zero additional charges. Check account usage in Cloudflare Billing before increasing traffic or enabling live inference.

To rebuild and deploy the preview from a validated commit in PowerShell:

```powershell
pnpm --filter @faultline/api exec wrangler deploy --config wrangler.preview.jsonc
$env:VITE_API_URL='https://faultline-api-preview.judithorluchee.workers.dev'
pnpm --filter @faultline/web build
pnpm --filter @faultline/api exec wrangler pages deploy ../web/dist --project-name faultline-web-preview --branch main
```

Run the browser journey against the deployment:

```powershell
$env:FAULTLINE_STAGING_URL='https://faultline-web-preview.pages.dev'
pnpm e2e
```

The deployment is a hypothetical workflow simulator. It does not execute deployments or guarantee production safety. Public live inference requires a separate security and billing review.
