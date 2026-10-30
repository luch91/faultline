# Minsk Failure Benchmark v1

Run `pnpm benchmark` from a clean checkout after `pnpm install --frozen-lockfile`. This command uses no model API. It reads the 12 locked JSON cases in `benchmark/cases`, compares simulator output with each case's stated policy reasoning and expected trace, writes `benchmark/results/latest.json`, and exits nonzero on a mismatch. The results directory is ignored by Git.

The expected outcomes were written from the source policy and execution specification in each fixture before the benchmark run. Each case includes a `groundTruth.justification`. This is independent human-readable policy reasoning, not a second software evaluator or evidence of live production behavior. The benchmark test does not update those expectations.

MFB-01 through MFB-06 exercise six declared requirements missing from execution gates. MFB-07 is a correctly blocked negative control; MFB-08 is healthy execution. MFB-09 requires an indeterminate result for unknown evidence. MFB-10 checks dependent-step blocking. MFB-11 and MFB-12 reject invalid graph and source evidence.

On October 30, 2026, the local run reported 12 passed, zero failed, six verified repairs, zero false positives, and one indeterminate case. This is a deterministic fixture result. It does not measure extraction quality, model recall, or real-world failure rates. The result JSON records fixture and evaluator versions, a fixture hash, and the checkout commit used for the run.
