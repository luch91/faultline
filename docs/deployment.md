# Staging deployment

The public deterministic preview is at https://faultline-web-preview.pages.dev. The API Worker is at https://faultline-api-preview.judithorluchee.workers.dev. These addresses were verified on October 27, 2026.

The Pages project is a separate direct-upload staging project. Its frontend build sets `VITE_API_URL` to the preview Worker URL. The Worker uses `apps/api/wrangler.preview.jsonc`. Both public preview Workers have live model calls disabled while the multi-model integration is being verified. Meta's Standard-mode key may remain stored as a Worker secret, but the model route refuses requests while its switch is off. The $100 internal ledger ceiling, daily and per-client allowances, and request throttling remain in code. Promotional-credit expiry or exhaustion must be monitored in Meta Billing; the Worker cannot verify that balance automatically.

The authorized Cloudflare account is on an existing Workers Paid plan. Cloudflare can charge for usage beyond the plan's included allowances. The preview has no Cloudflare account-level spend cap, so its public availability does not guarantee zero additional charges. The owner confirmed current usage is within the account budget.

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
