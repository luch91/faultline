# Security and spending controls

Workflow text is untrusted data. Minsk does not execute it. Provider tool names and arguments are validated before the deterministic simulator runs, and model hypotheses never determine an execution outcome. API request bodies are capped, origins must exactly match `ALLOWED_ORIGIN`, and provider keys stay in ignored local secret files or Cloudflare secrets.

The persistent Durable Object reserves a conservative estimate before every provider dispatch, then stores reported token usage, latency and classified provider errors when available. Missing usage remains conservatively reserved. Meta has a configurable application estimate ceiling that defaults to $50. Baseten is uncapped by application dollars per owner policy, but remains metered and protected by its kill switch, rate limits, bounded output, timeout, validation and global dispatch controls. These controls are not provider billing hard limits.

Model endpoints require explicit server-side switches. The controlled benchmark route additionally requires a private evaluation token. Browser users never receive provider credentials. A single investigation lock prevents overlapping tool investigations, while request limits apply even without an Origin header.

Certificate integrity proves that the canonical certificate content has not changed. It does not prove issuer identity. Operators must reconcile estimates with provider billing and should disable model switches immediately when a provider or accounting anomaly is observed.
