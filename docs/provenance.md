# Provenance

The project source was created in a separate local repository on October 26, 2026. The Missing Approval fixture describes a synthetic deployment workflow, not a recorded production incident. Its source spans and source hash can be independently checked.

The owner is Ekeleme Fortune. No other human contributors are claimed. Repository commits use the authorized `luch91` identity.

Run `pnpm verify:certificate <certificate.json> [original-workflow.json]` to check an exported certificate. The verifier validates the schema and version, recomputes the canonical integrity hash and evaluator result identifiers, and checks internal outcome relationships. With the original workflow JSON, it also recomputes source and workflow hashes, baseline, counterfactual, and safeguard evaluations. A result without the workflow reports `inputVerified: false`. Both modes report `provenanceAuthenticity: NOT_VERIFIED`: an unkeyed hash detects changes but does not prove that Minsk or a model provider issued the file.
