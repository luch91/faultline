# Minsk

[![CI](https://github.com/luch91/minsk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/luch91/minsk/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-in%20use-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-frontend-149ECA?logo=react&logoColor=white)
[![License](https://img.shields.io/github/license/luch91/minsk)](https://github.com/luch91/minsk/blob/main/LICENSE)

Minsk tests declared deployment policy against the conditions an automated workflow actually checks.

## Staging preview

[Open the Minsk functional preview](https://minsk-web-preview.pages.dev). Its [API health endpoint](https://minsk-api-preview.judithorluchee.workers.dev/healthz) responds successfully. Live Meta and Baseten inference are disabled on this preview.

## Product demonstration

The included Missing Approval fixture declares human approval as mandatory but leaves it out of the execution gate. Removing approval produces `UNSAFE_EXECUTION`. Adding the approval gate to a copied graph produces `SAFE_BLOCK`.

This branch provides a temporary functional interface with workflow input, structured conditions and gates, evaluation results, replay traces, certificates, and benchmark results. The rejected visual graph is removed from the active application.

## Approach

The simulator evaluates policy rules and execution gates independently. Meta Muse Spark handles evidence-linked extraction and routine investigation. Muse Wonder is routed to bounded complex investigations. A Baseten-hosted Meta Muse Spark Open challenger independently proposes condition changes when its private test switch is enabled. All candidates are validated and evaluated by the same simulator. The frontend lets a user correct observations and gates before simulation.

## Architecture

- `apps/web`: React and Vite with a minimal functional testing interface.
- `apps/api`: Cloudflare Worker routes, Meta calls, and Durable Object spending ledger.
- `packages/contracts`: Zod data contracts.
- `packages/simulator`: pure TypeScript evaluator.
- `fixtures`: reproducible scenario data.
- `benchmark/cases`: 12 versioned, independently justified failure cases.

## Evidence and semantics

Model extraction is accepted only when every cited excerpt matches the submitted text and graph references validate. Missing observations evaluate as `UNKNOWN`. A policy violation with eligible execution is `UNSAFE_EXECUTION`. A correctly blocked operation is `SAFE_BLOCK`. Evaluation IDs omit timestamps.

## Meta status

Controlled local tests completed Spark extraction and two-turn Spark and Wonder investigations. Both investigators called `run_counterfactual`, received a simulator result, then called `propose_safeguard`. Investigation certificates verify server-side model provenance before export. A separate Baseten Muse Spark Open call proposed three candidates that the simulator evaluated. The local ledger records reserved, provider-reported, and unknown usage separately. Meta Billing showed a rounded $0.04 balance change for the five latest Meta calls against a $0.033150 local estimate. Baseten promotional balance and award eligibility remain unverified; the public preview keeps all live inference disabled.

## Install

Use Node 22 and pnpm 10. Run `pnpm install --frozen-lockfile` in the repository root. Copy `.env.example` values into `apps/api/.dev.vars` only when local live inference is authorized. The key file is ignored by Git. `pnpm dev` starts the local Worker and frontend with model calls disabled.

## Commands

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm benchmark`, `pnpm build`, `pnpm e2e`, `pnpm audit --audit-level high`, `pnpm check:content`, `pnpm check:secrets`. `pnpm benchmark` runs offline, includes a separate reference oracle, and writes JSON results in `benchmark/results`. `pnpm verify:certificate <certificate.json> [original-workflow.json]` independently checks an export. `pnpm model:evaluate` prints a call-free evaluation plan. Playwright E2E starts a local Worker and frontend without Meta inference.

Set `MINSK_STAGING_URL` to a verified preview URL to run the browser journey against staging without starting local servers.

### Fresh model benchmark

`pnpm benchmark` is offline and makes no model calls. `pnpm benchmark:models -- --provider all` runs new inference on the eight locked synthetic held-out cases. Choose `meta` or `baseten` to test one provider. It writes per-case responses and locked reference labels to ignored `model-evaluation/results/`. Provider failures are recorded, not scored as successful calls. The results do not establish real-world accuracy.

The model benchmark uses the existing protected Worker and its persistent ledger. For local BYOK, place your own provider credentials and the protected evaluation tokens in the ignored `apps/api/.dev.vars`, enable the desired provider switches, configure `BASETEN_CEILING_MICRO_USD`, and start the local Worker. Set `MINSK_EVAL_API_URL` to its localhost URL, `MINSK_EVAL_TOKEN` to the Worker evaluation token, and, for Baseten, `MINSK_EVAL_TEST_TOKEN` to the challenger token. For hosted access, set the URL to the authorized HTTPS Worker and obtain the protected tokens from its operator. Provider keys remain server-side in both modes. The CLI makes no silent fallback to archived responses.

The Meta ledger defaults to $50 across Spark and Wonder, configurable downward with `META_CEILING_MICRO_USD`. Baseten requires an explicit positive `BASETEN_CEILING_MICRO_USD`; no fixed $10 provider ceiling applies. Evaluation calls also require configured dispatch and estimated-cost limits. Estimates and reservations are application controls, not a provider-side billing guarantee. Unknown usage retains the reservation.

## Security and limitations

Minsk never runs a submitted workflow. It evaluates declared semantics rather than arbitrary programs. Extraction can be wrong and must be reviewed. Unknown or unstated execution conditions cannot be verified. Safeguards are hypothetical and do not guarantee production safety. The spending ledger is a protective control and must be reconciled with Meta Billing. Request and model-call limits are in place; live inference can be disabled through the Worker switch. Promotional-credit expiry is not detected automatically. The complete multi-tool catalogue remains outside this milestone.

## Hackathon contribution

Created for the Meta Global AI Developer Hackathon 2026 by Ekeleme Fortune under the `luch91` GitHub account. Participant status requires independent verification. No other contributors are claimed.

## License

MIT. See [LICENSE](LICENSE).
