# Model evaluation

Minsk has two separate evaluation modes. `pnpm benchmark` is deterministic, offline and CI-safe. It runs the 12 versioned Minsk Failure Benchmark cases against the simulator and independent reference oracle. It does not contact a provider.

`pnpm benchmark:models -- --provider meta`, `baseten`, or `all` performs fresh provider calls against eight locked synthetic held-out workflows. It requires `MINSK_EVAL_API_URL` and `MINSK_EVAL_TOKEN`; Baseten also requires `MINSK_EVAL_TEST_TOKEN`. A local Worker with credentials in ignored `.dev.vars` is BYOK. A hosted Worker needs an operator-issued evaluation token. Provider keys are never sent to the CLI.

Each result file records the locked reference, API latency, per-provider telemetry, token usage when reported, estimated usage cost, accounting status, errors, dispatches, retries, fallback count, extraction checks, outcome agreement, unsafe-detection confusion counts, correct indeterminate handling, and independently verified safeguards. The command fails on provider errors instead of presenting a partial run as success. Results are written to ignored `model-evaluation/results/`.

The historical controlled comparison remains immutable in `model-evaluation/`. It contains 48 model-case tasks on eight synthetic scenarios and is not real-world accuracy evidence. The recorded provider token estimate was $0.330163; final provider billing was not returned. See `report-2026-10-30.md`, `scored-2026-10-30.json`, and `ground-truth.json` for exact samples and limitations.

The evaluation dispatch limit covers both providers. `MINSK_EVAL_MAX_MICRO_USD` is a Meta-only conservative estimate limit. Meta's application ceiling defaults to $50. Baseten has no application-dollar ceiling, but retains its authentication, input validation, request, dispatch, timeout and rate controls. Neither local estimate is a provider-side billing guarantee.
