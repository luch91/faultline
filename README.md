# Faultline

[![CI](https://github.com/luch91/faultline/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/luch91/faultline/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-in%20use-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-frontend-149ECA?logo=react&logoColor=white)
[![License](https://img.shields.io/github/license/luch91/faultline)](https://github.com/luch91/faultline/blob/main/LICENSE)

Faultline tests declared deployment policy against the conditions an automated workflow actually checks.

## Staging preview

[Open the current Faultline preview](https://feat-reference-visual-integr-k0mv.faultline-web-preview.pages.dev). This preview exposes the deterministic sample and keeps live model inference disabled. Its Worker is at [faultline-api-visual-preview.judithorluchee.workers.dev](https://faultline-api-visual-preview.judithorluchee.workers.dev/healthz).

## Product demonstration

The included Missing Approval fixture declares human approval as mandatory but leaves it out of the execution gate. Removing approval produces `UNSAFE_EXECUTION`. Adding the approval gate to a copied graph produces `SAFE_BLOCK`.

This branch replaces the frontend with a code-rendered multi-cluster network, focused radial relationships, ranking directory, and analytics based on the locked video reference. The 18.567-second presentation follows measured state boundaries, line formation, radial expansion, analytics expansion, and graph return movement. Investigation, replay, source editing, and certificate export use the existing backend. The application plane remains stable during presentation motion.

## Approach

The simulator evaluates policy rules and execution gates independently. Meta Muse Spark handles evidence-linked extraction and routine investigation. Muse Wonder is routed to bounded complex investigations. A Baseten-hosted Meta Muse Spark Open challenger independently proposes condition changes when its private test switch is enabled. All candidates are validated and evaluated by the same simulator. The frontend lets a user correct observations and gates before simulation.

## Architecture

- `apps/web`: React and Vite with interactive SVG networks, projected live DOM, and a Canvas presentation surround.
- `apps/api`: Cloudflare Worker routes, Meta calls, and Durable Object spending ledger.
- `packages/contracts`: Zod data contracts.
- `packages/simulator`: pure TypeScript evaluator.
- `fixtures`: reproducible scenario data.

## Evidence and semantics

Model extraction is accepted only when every cited excerpt matches the submitted text and graph references validate. Missing observations evaluate as `UNKNOWN`. A policy violation with eligible execution is `UNSAFE_EXECUTION`. A correctly blocked operation is `SAFE_BLOCK`. Evaluation IDs omit timestamps.

## Meta status

Controlled local tests completed Spark extraction and two-turn Spark and Wonder investigations. Both investigators called `run_counterfactual`, received a simulator result, then called `propose_safeguard`. Investigation certificates verify server-side model provenance before export. A separate Baseten Muse Spark Open call proposed three candidates that the simulator evaluated. The local ledger records reserved, provider-reported, and unknown usage separately. Meta Billing showed a rounded $0.04 balance change for the five latest Meta calls against a $0.033150 local estimate. Baseten promotional balance and award eligibility remain unverified; the public preview keeps all live inference disabled.

## Install

Use Node 22 and pnpm 10. Run `pnpm install` in the repository root. Copy `.env.example` values into `apps/api/.dev.vars` and add the Meta key locally. The key file is ignored by Git. Run `pnpm --filter @faultline/api exec wrangler dev` and `pnpm --filter @faultline/web dev` in separate terminals.

## Commands

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e`, `pnpm audit --audit-level high`, `pnpm check:content`, `pnpm check:secrets`. Playwright E2E starts a local Worker and frontend and runs without Meta inference.

Set `FAULTLINE_STAGING_URL=https://faultline-web-preview.pages.dev` before `pnpm e2e` to run the same browser journey against staging without starting local servers.

## Security and limitations

Faultline never runs a submitted workflow. It evaluates declared semantics rather than arbitrary programs. Extraction can be wrong and must be reviewed. Unknown or unstated execution conditions cannot be verified. Safeguards are hypothetical and do not guarantee production safety. The spending ledger is a protective control and must be reconciled with Meta Billing. Request and model-call limits are in place; live inference can be disabled through the Worker switch. Promotional-credit expiry is not detected automatically. The complete multi-tool catalogue remains outside this milestone.

## Hackathon contribution

Created for the Meta Global AI Developer Hackathon 2026 by Ekeleme Fortune under the `luch91` GitHub account. Participant status requires independent verification. No other contributors are claimed.

## License

MIT. See [LICENSE](LICENSE).
