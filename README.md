# Minsk

[![CI](https://github.com/luch91/minsk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/luch91/minsk/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/luch91/minsk)](LICENSE)

Minsk investigates discrepancies between a workflow's declared policies and the conditions its execution steps actually enforce. It tests hypothetical changes, explains the resulting execution path, and verifies candidate safeguards against a deterministic model of the workflow.

The simulator evaluates declared workflow semantics. It does not execute an external deployment or verify infrastructure settings that were not supplied as evidence.

```text
Workflow text or structured input
  -> Spark extraction and source validation
  -> Policy requirements and execution gates
  -> Deterministic baseline and counterfactual
  -> Model-proposed safeguard and deterministic verification
  -> Trace and integrity-checked certificate
```

Spark handles extraction and routine investigations. Wonder can be routed to complex investigations. A Baseten-hosted Meta Muse Spark Open challenger proposes additional interventions. Every model proposal is validated and simulator outcomes remain authoritative.

## Quickstart

Use Node.js 22 and pnpm 10.18.3.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm benchmark
pnpm dev
```

The offline benchmark uses 12 versioned cases and an independent reference oracle. It makes no provider calls. The [preview](https://minsk-web-preview.pages.dev) exposes a budgeted live test environment only when its server-side switches and provider secrets are configured. Its status is visible at `/api/v1/budget`; a disabled or exhausted provider is reported to the caller rather than simulated.

For the Missing Approval fixture, the baseline is `SAFE_EXECUTION`. Changing approval to false yields `UNSAFE_EXECUTION` because deployment lacks that gate. Adding the gate yields `SAFE_BLOCK` while the policy condition remains violated.

## Live model setup

Copy the names in [.env.example](.env.example) into the ignored `apps/api/.dev.vars` and provide your own credentials there. Never put provider keys in browser code or commit them. Start the Worker locally with Wrangler; see [model integration](docs/model-integration.md).

| Setting | Purpose | Safe default |
| --- | --- | --- |
| `MODEL_API_KEY` | Server-side Meta key | unset |
| `MODEL_CALLS_ENABLED` | Meta kill switch | false |
| `WONDER_ENABLED` | Allow Wonder escalation | false |
| `META_CREDITS_CONFIRMED` and `META_BILLING_MODE` | Operator billing confirmation | false and Standard |
| `META_CEILING_MICRO_USD` | Cumulative Meta estimate ceiling | 50000000 |
| `BASETEN_API_KEY` | Server-side Baseten key | unset |
| `BASETEN_CHALLENGER_ENABLED` and `BASETEN_CREDITS_CONFIRMED` | Baseten controls | false |
| `PUBLIC_CHALLENGER_ENABLED` | Permit public challenger calls | false |
| `BASETEN_TEST_TOKEN` | Protect challenger access | unset |
| `MINSK_EVAL_TOKEN` | Protect controlled benchmark access | unset |
| `MINSK_EVAL_MAX_CALLS`, `MINSK_EVAL_MAX_MICRO_USD` | Controlled evaluation dispatch limit and Meta estimate ceiling | 6 calls, 300000 |
| `PUBLIC_GLOBAL_REQUESTS_PER_MINUTE`, `PUBLIC_CLIENT_REQUESTS_PER_MINUTE` | Enforced public API request quotas | 300, 30 |
| `PUBLIC_GLOBAL_MODEL_CALLS_PER_DAY`, `PUBLIC_CLIENT_MODEL_CALLS_PER_DAY` | Enforced public provider-dispatch quotas | 30, 5 |
| `ALLOWED_ORIGIN` | Allowed browser origin | unset |

Reservations, settled token estimates and unknown usage are recorded in a persistent Durable Object. Meta is constrained by the $50 application ceiling; Baseten is metered but has no application-dollar ceiling. Public quotas are enforced globally and per browser session plus Cloudflare client IP. Neither is a provider-side billing guarantee. Check [Meta](https://dev.meta.ai/docs/pricing-rate-limits) and [Baseten](https://www.baseten.co/pricing/) rates and your account's billing conditions before enabling calls.

Extracted workflows retain explicit `ALL` or `ANY` policy rules, evidence excerpts, optional freshness requirements in seconds, and optional observation timestamps. The workbench permits operators to correct those values only when evidence remains an exact excerpt of the supplied source. Stale, absent, ambiguous, and contradictory observations evaluate as unknown rather than false.

## Benchmarks and certificates

```sh
pnpm benchmark
pnpm benchmark:models -- --provider meta
pnpm verify:certificate path/to/certificate.json path/to/workflow.json
```

`benchmark:models` performs fresh inference against the eight locked held-out cases, using `meta`, `baseten`, or `all`. Set `MINSK_EVAL_API_URL` and `MINSK_EVAL_TOKEN`; Baseten also requires `MINSK_EVAL_TEST_TOKEN`. Use a local Worker with your own keys, or an authorized HTTPS Worker with operator-provided access tokens. Results are written to ignored `model-evaluation/results/`. A stopped run can be continued with `--resume <result-path>`. Errors are recorded; synthetic results are not real-world accuracy claims.

The independent verifier recomputes integrity and, when the original workflow is supplied, verifies the source, workflow and deterministic results. Integrity does not establish issuer authenticity.

`evaluation/real-configuration-cases.json` contains two read-only, independently sourced GitHub configuration evidence cases with locked `INDETERMINATE` ground truth. They test the boundary between observed workflow text and unobserved external enforcement. They are not included in synthetic accuracy metrics and do not establish real-world detection accuracy.

## API and development

Routes include `/healthz`, `/api/v1/samples`, `/api/v1/workflows/validate`, `/api/v1/workflows/extract`, `/api/v1/experiments/run`, `/api/v1/investigations`, `/api/v1/safeguards/verify`, `/api/v1/challengers/open-weight`, `/api/v1/reports/export`, `/api/v1/reports/verify`, `/api/v1/benchmark` and `/api/v1/budget`.

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:content`, `pnpm check:secrets`, `pnpm audit --audit-level high` and `pnpm e2e`. For an API that returns HTML instead of JSON, check `VITE_API_URL`, the Worker health endpoint and its allowed origin. A disabled provider requires the switches, credentials and budget configuration described above.

Further reading: [architecture](docs/architecture.md), [benchmark](docs/benchmark.md), [model integration](docs/model-integration.md), [model evaluation](docs/model-evaluation.md), [provenance](docs/provenance.md), [security](docs/security.md), and [deployment](docs/deployment.md). See [CONTRIBUTING.md](CONTRIBUTING.md) and the [MIT license](LICENSE).
