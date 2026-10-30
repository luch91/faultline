# Issue 8 local provider smoke test

On 2026-10-30 a protected local Worker made six provider calls under a $0.25 Meta ceiling, a $0.25 Baseten ceiling, and a $0.25 shared evaluation reservation ceiling. The test used the existing configured provider keys. Reported-token estimates total $0.034263; the provider's final billing was not available.

| Task | Provider model | Result | Elapsed |
| --- | --- | --- | --- |
| Extraction | muse-spark-1.3 | Validated workflow and source spans | 7011 ms |
| Investigation | muse-spark-1.3 | SAFE_EXECUTION, UNSAFE_EXECUTION, SAFE_BLOCK; certificate verified | 3950 ms |
| Investigation | muse-wonder-1.0 | SAFE_EXECUTION, UNSAFE_EXECUTION, SAFE_BLOCK; certificate verified | 6029 ms |
| Challenger | meta-models/muse-spark-open-1026 | Three candidates: SAFE_BLOCK, UNSAFE_EXECUTION, SAFE_BLOCK | 5158 ms |

Reported token totals were 2,152 input and 1,199 output for Spark; 1,805 input and 692 output for Wonder; 328 input and 1,178 output for Baseten. The local ledger recorded $0.028846 for Meta and $0.005417 for Baseten using the configured rate estimates. This test forced the investigator model for comparison and does not by itself verify automatic escalation. Certificate integrity and original input matched; issuer authenticity was not verified.

The machine-readable local result is stored in ignored `model-evaluation/results/issue8-smoke.json`. It contains synthetic workflow and provider output, not credentials. These tests do not establish real-world accuracy or prove provider charges.

A subsequent fresh held-out benchmark on the same local ledger evaluated eight synthetic cases. Spark extraction matched 8/8 checks. Spark and Wonder each matched 8/8 requested-target simulator outcomes, including four unsafe cases, three safe negative controls and one indeterminate case; each had four verified repairs. Baseten returned matching requested-target outcomes for 7/8 cases; H04 returned malformed candidate JSON. These are small synthetic samples. The protected comparison was interrupted by the configured dispatch and reservation ceilings and resumed after increasing only the local test limits. At completion, the ledger recorded 55 cumulative dispatches, $1.519031 in conservative reservations and $0.282516 in reported-token estimates. Final provider billing was not available. See the machine-readable [Meta](../model-evaluation/issue8-meta-2026-10-30.json) and [Baseten](../model-evaluation/issue8-baseten-2026-10-30.json) results.
