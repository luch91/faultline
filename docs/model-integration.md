# Model integration

The API uses `muse-spark-1.3` through Meta Responses at `https://api.meta.ai/v1/responses`. The model identifier is hardcoded. Extraction uses a JSON schema and Zod validation. Evidence excerpts must be exact source substrings. Investigation uses a function tool and validates its arguments before simulation.

Live requests require `MODEL_CALLS_ENABLED=true`, `META_CREDITS_CONFIRMED=true`, `META_BILLING_MODE=Standard`, a nonempty `MODEL_API_KEY`, and a successful Durable Object budget reservation. A request reserves a conservative maximum token estimate. Actual token usage replaces the reservation only when the provider returns usage. Failed or usage-free calls are marked as unknown usage and retain conservative accounting. The ledger reports these states separately.

Pricing estimates use the October 26, 2026 Standard Muse Spark rates of $1.25 per million input tokens and $4.25 per million output tokens. They must be reviewed against [Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits) and reconciled with Meta Billing. The ledger is not a provider billing guarantee.

Two live extraction responses passed graph and evidence validation. A live two-turn investigation used the simulator result to select an approval gate and verified `SAFE_BLOCK`. The provider response IDs were observed locally. New investigations store sanitized response IDs, tool IDs, token usage, and verification outcome in a server-side attestation. Export recomputes the evaluation and checks that attestation before adding live model metadata. A deterministic fixture certificate records no live model. Open-weight inference remains disabled and unclaimed.
