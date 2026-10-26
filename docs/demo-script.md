# Demo script

1. Open the Design workspace and load The Missing Approval sample.
2. Inspect the policy rule and the execution gates. Approval appears in policy but not in the gate.
3. Open Experiment. Select human approval and apply an absent observation.
4. Inspect `UNSAFE_EXECUTION`, the violated rule, and the still eligible deployment step.
5. Test the approval safeguard. Inspect `SAFE_BLOCK`.
6. Open Replay and step through the three lanes.
7. Export the certificate and inspect its integrity hash.

Use live Meta extraction and agent activity only after a real response has been tested. Never represent the sample fixture as live extraction.
