# Faultline

[![CI](https://github.com/luch91/faultline/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/luch91/faultline/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-in%20use-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-frontend-149ECA?logo=react&logoColor=white)
[![License](https://img.shields.io/github/license/luch91/faultline)](https://github.com/luch91/faultline/blob/main/LICENSE)

Faultline tests declared deployment policy against the conditions an automated workflow actually checks.

## Product demonstration

The included Missing Approval fixture declares human approval as mandatory but leaves it out of the execution gate. Removing approval produces `UNSAFE_EXECUTION`. Adding the approval gate to a copied graph produces `SAFE_BLOCK`.

## Approach

The simulator evaluates policy rules and execution gates independently. Meta Muse Spark is used for evidence-linked workflow extraction and a bounded two-turn investigation when credited Standard-mode access is configured. Model output cannot override simulator results. The frontend lets a user correct observations and gates before simulation.

## Architecture

- `apps/web`: React, Vite, React Flow interface.
- `apps/api`: Cloudflare Worker routes, Meta calls, and Durable Object spending ledger.
- `packages/contracts`: Zod data contracts.
- `packages/simulator`: pure TypeScript evaluator.
- `fixtures`: reproducible scenario data.

## Evidence and semantics

Model extraction is accepted only when every cited excerpt matches the submitted text and graph references validate. Missing observations evaluate as `UNKNOWN`. A policy violation with eligible execution is `UNSAFE_EXECUTION`. A correctly blocked operation is `SAFE_BLOCK`. Evaluation IDs omit timestamps.

## Meta status

Live Meta extraction and the two-turn tool investigation have been tested locally against the credited account. The model called `run_counterfactual`, received a simulator result, then called `propose_safeguard`. New investigation certificates verify server-side model provenance before export. The local ledger records reserved, provider-reported, and unknown usage separately; it has not been reconciled against Meta Billing. Eligible open-weight integration is not available in this milestone.

## Install

Use Node 22 and pnpm 10. Run `pnpm install` in the repository root. Copy `.env.example` values into `apps/api/.dev.vars` and add the Meta key locally. The key file is ignored by Git. Run `pnpm --filter @faultline/api exec wrangler dev` and `pnpm --filter @faultline/web dev` in separate terminals.

## Commands

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e`, `pnpm audit --audit-level high`, `pnpm check:content`, `pnpm check:secrets`. Playwright E2E starts a local Worker and frontend and runs without Meta inference.

## Security and limitations

Faultline never runs a submitted workflow. It evaluates declared semantics rather than arbitrary programs. Extraction can be wrong and must be reviewed. Unknown or unstated execution conditions cannot be verified. Safeguards are hypothetical and do not guarantee production safety. The spending ledger is a protective control and must be reconciled with Meta Billing. Request and model-call limits are in place, but public live inference remains disabled pending reconciliation and deployment review. The complete multi-tool catalogue remains outside this milestone.

## Hackathon contribution

Created for the Meta Global AI Developer Hackathon 2026 by Ekeleme Fortune under the `luch91` GitHub account. Participant status requires independent verification. No other contributors are claimed.

## License

MIT. See [LICENSE](LICENSE).
