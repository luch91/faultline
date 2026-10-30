# Preview deployment

The Minsk functional preview is deployed at https://minsk-web-preview.pages.dev and its Worker is https://minsk-api-preview.judithorluchee.workers.dev. The Worker configuration is `apps/api/wrangler.preview.jsonc` and uses a persistent Durable Object budget ledger.

Deploy only a validated commit. First run the Worker dry build, deploy the Worker with the project-local Wrangler configuration, then deploy the corresponding Pages build with `VITE_API_URL` set to the Worker URL. Verify `/healthz`, `/api/v1/budget`, samples, baseline evaluation, counterfactual, safeguard verification, certificate export and certificate verification from the deployed browser.

Preview model availability is controlled entirely by server-side configuration. `MODEL_CALLS_ENABLED`, `WONDER_ENABLED`, `BASETEN_CHALLENGER_ENABLED`, credit-confirmation settings and server secrets must all be present before live calls work. `/api/v1/budget` exposes switch status and metered accounting without revealing secrets. A model provider may still reject a request or report no usage; those cases remain visible to callers and in ledger telemetry.

The preview is not production. Do not change production routes, retire resources, or expose provider keys while validating a preview deployment.
