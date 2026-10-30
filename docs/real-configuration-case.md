# Read-only GitHub Actions configuration case

Source: this repository's current `.github/workflows/ci.yml` on `main`. It runs dependency installation, content and secret scans, typecheck, lint, unit tests, the deterministic benchmark, build, audit, and browser tests. The workflow has no deployment job, environment reference, deployment credential, or production action.

On October 30, 2026, authenticated read-only GitHub API calls returned zero repository Environments, one active workflow (`.github/workflows/ci.yml`), and `Branch not protected` for `main`. The authenticated account has repository admin read access. These results can be reproduced with `gh api repos/luch91/minsk/environments`, `gh api repos/luch91/minsk/actions/workflows`, and `gh api repos/luch91/minsk/branches/main/protection`. A 404 on the last call means GitHub reported no branch protection for `main`; it does not establish an unsafe deployment path.

Verified policy requirement: CI checks are declared in the workflow. Verified execution controls: those checks are run by GitHub Actions on pull requests and main. Absent in this repository: GitHub Environments, protected branch rules, and a deployment job in the inspected workflow. Unobserved: deployment controls in Cloudflare or any other external system. Because this repository workflow does not deploy, a human-approval deployment claim is not applicable here. Any broader claim about release approval remains indeterminate without the external deployment configuration and policy.

This case demonstrates the boundary between observed workflow configuration and unobserved external enforcement. No production workflow was executed or modified.

The companion [real configuration evidence set](../evaluation/real-configuration-cases.json) records this case alongside the relevant GitHub Actions environment documentation. Its expected labels are independently reasoned from observable configuration and are intentionally `INDETERMINATE` where the configuration does not provide evidence. These two cases expand evidence coverage beyond synthetic simulator fixtures, but they do not establish field accuracy or a real-world detection rate.
