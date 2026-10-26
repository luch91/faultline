# Simulation semantics

Conditions compare an observed value to an expected value. Null observations and expired evidence are `UNKNOWN`. A requirement group with `ALL` is violated when any requirement is violated, unknown when none is violated and one is unknown, and satisfied otherwise. An `ANY` group is satisfied if any requirement is satisfied, unknown if none is satisfied and one is unknown, and violated otherwise.

Step eligibility combines execution gates and upstream step eligibility. Policy rules are evaluated separately. A violated policy for an executing step is `UNSAFE_EXECUTION`. If no unsafe rule exists and required evidence is unknown, the result is `INDETERMINATE`. Executing a deployment with no unsafe rule is `SAFE_EXECUTION`. Blocking it is `SAFE_BLOCK`.

Interventions only change a copied condition map. Safeguards add a gate to a copied graph. Result IDs are hashes of normalized semantic data and exclude timestamps. Evaluation traces drive the replay interface.

The engine does not execute submitted workflows or predict real production behavior.
