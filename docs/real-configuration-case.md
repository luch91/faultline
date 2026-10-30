# Read-only GitHub Actions configuration case

Source: this repository's `.github/workflows/ci.yml` at the checked-out commit. The workflow runs dependency installation, content and secret scans, typecheck, lint, unit tests, the deterministic benchmark, build, audit, and browser tests. These checks are declared in repository YAML and can be inspected without executing a deployment.

The YAML does not establish whether a protected deployment environment requires human approval. GitHub environment protection and repository settings are separate enforcement surfaces. This checkout does not contain verified read access to those settings. Minsk therefore cannot claim that deployment approval is missing or that a real deployment path is unsafe based on this YAML alone. The correct conclusion for external approval enforcement is indeterminate pending a read-only check of the relevant GitHub settings.

This case demonstrates the boundary between observed workflow configuration and unobserved external enforcement. No production workflow was executed or modified.
