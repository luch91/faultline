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
