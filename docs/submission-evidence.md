# Minsk submission evidence for owner review

## Product

Minsk compares an agent workflow's declared policy with its actual execution gates. It accepts a structured workflow or uses Muse Spark to extract one from text, validates source spans, evaluates the baseline, tests a changed condition, and checks a proposed gate in a deterministic simulator. A Counterexample Certificate records the workflow and source hashes, intervention, trace, outcomes, and any attested model calls. The simulator models declared workflow behavior; it does not execute a deployment or establish the state of external infrastructure.

The backend uses Meta Muse Spark 1.3 for extraction and routine investigation, selectively routes complex validated workflows to Muse Wonder 1.0, and uses Baseten-hosted Meta Muse Spark Open as a candidate challenger. Models propose hypotheses; the deterministic evaluator decides execution outcomes. The public [preview](https://minsk-web-preview.pages.dev) keeps live inference disabled. The [repository](https://github.com/luch91/minsk) and [draft integration PR](https://github.com/luch91/minsk/pull/6) contain the implementation.

## Reproducible demonstration

From a clean checkout, run `pnpm install --frozen-lockfile`, then `pnpm demo:journey`. This uses the versioned [Missing Approval fixture](../fixtures/workflows/missing-approval.ts) and makes no provider call. It asserts and prints:

1. Baseline with passing tests, compatible migration, and approval present: `SAFE_EXECUTION`.
2. Counterfactual with approval absent and no approval execution gate: `UNSAFE_EXECUTION`, violating `approval-required` while deployment remains eligible.
3. Safeguard adding approval as a deployment gate: `SAFE_BLOCK`, with `resolved: true`.
4. Certificate export to `demo/results/certificate.json` and independent verification against `demo/results/workflow.json`.

Run `pnpm verify:certificate demo/results/certificate.json demo/results/workflow.json` to repeat the certificate check. A valid integrity hash plus matching original input establishes consistency, not issuer authenticity.

In the public preview, select **The Missing Approval**, inspect its policy rule and actual gates, choose **Human approval present** under Intervention target, click **Run counterfactual**, then **Verify safeguard**. Use the BASELINE, COUNTERFACTUAL, and SAFEGUARD replay controls, inspect the execution trace, and click **Export certificate**. The preview does not make a fresh Meta call. For recorded model behavior, show the clearly labeled [2026-10-30 live evaluation evidence](../model-evaluation/report-2026-10-30.md), including actual tool traces in the [raw results](../model-evaluation/evidence-2026-10-30.json). Do not present those recordings as fresh inference.

## Evaluation and limits

The controlled comparison completed 48 model-case tasks on eight distinct synthetic scenarios with 60 budgeted provider dispatches. The [scored rows](../model-evaluation/scored-2026-10-30.json) and [locked reference labels](../model-evaluation/ground-truth.json) preserve the full breakdown. Spark extraction passed 7/8 strict checks. Spark and Wonder each completed 7/8 primary assisted tasks and independently verified 4/4 available unsafe repairs. Baseten completed 6/8 primary challenger tasks. Direct Spark completed 7/8 primary analysis tasks without verified repairs. These small, structurally similar cases do not establish real-world accuracy. Wonder showed no measured advantage over Spark on this set. The original raw and scored evidence is retained unchanged after remediation.

Known limits: Baseten candidate reliability was imperfect; a cited source span did not prevent one incorrect unknown-evidence interpretation in the original run; external production deployment controls remain incompletely observed; and certificate integrity does not authenticate an issuer. The current correction has offline regression coverage but has not been remeasured with billable model calls.

## Official event information checked on 2026-10-30

The [Meta event page](https://dev.meta.ai/events/global-hackathon) and [Cerebral Valley event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) state that project submissions are due **November 4, 2026 at 9:00 PM ET**. They describe Indie Developer and Startup tracks and the Build for Your World and Push the Frontier themes. The event page describes the Indie track in terms of creativity, technical ambition, and a working result, and the Startup track in terms of technical execution and production durability. These are the published track descriptions, not a claim about an unpublished scoring rubric.

The public pages still refer selected participants to Official Rules, but the full accepted rules and authenticated submission form were not accessible in this review. Therefore the exact required fields, video format or length, repository visibility rules, and final submission receipt are **not verified**. The owner must check the accepted rules and live submission form before filing. This package supplies evidence and a demonstration script; it does not claim a completed hackathon submission and does not include a demo video.
