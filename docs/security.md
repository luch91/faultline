# Security

User workflow text is untrusted. The Worker does not execute code from it. Model tool names and arguments are validated before the simulator runs. Meta credentials remain server-side in `.dev.vars` locally and Cloudflare secrets in deployment. The local secrets file is ignored by Git. The API caps request size and restricts CORS to `ALLOWED_ORIGIN`.

The spending guard reserves estimated usage in a persistent Durable Object before each model call. Operators must reconcile its estimate against Meta Billing. Public deployment should remain disabled until rate limits, credit reconciliation, timeout behavior, and production secret configuration are tested.

Known gaps: the current rate limit covers model calls, not every HTTP route; one session identifier is used for all anonymous requests until browser session IDs are wired in; API error responses need more careful classification before public release.
