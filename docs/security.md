# Security

User workflow text is untrusted. The Worker does not execute code from it. Model tool names and arguments are validated before the simulator runs. Meta credentials remain server-side in `.dev.vars` locally and Cloudflare secrets in deployment. The local secrets file is ignored by Git. The API caps request size and restricts CORS to `ALLOWED_ORIGIN`.

The spending guard reserves estimated usage in a persistent Durable Object before each model call. It enforces a $100 internal ceiling, daily and per-client model allowances, and a single active investigation. Every HTTP route has a global and per-client request limit, including requests without an Origin header. The browser session header is not used as an identity. Provider timeouts are bounded at 30 seconds. A production kill switch disables live model calls by default.

The ledger distinguishes reserved calls, calls with provider usage, and calls with unknown usage. Unknown usage remains conservatively accounted against the ceiling. Operators must reconcile the estimate against Meta Billing. The ledger does not establish the provider's actual charge or remaining promotional credit balance. Public live inference remains disabled pending reconciliation and controlled deployment verification.

The full dependency audit runs in CI. Vitest was upgraded to remove the vulnerable `tinypool@1.1.1` dependency. A local full audit passed on October 27, 2026.
