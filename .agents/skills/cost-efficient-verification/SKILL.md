---
name: cost-efficient-verification
description: Plan software verification, optimize GitHub Actions cost and speed, and prepare release evidence and Cursor handoffs without redundant checks. Use for slow or expensive CI, Actions quotas, CI audits, duplicate runs, billing-blocked checks, and frozen review candidates. Measure waste and preserve required gates.
---

# Cost-efficient verification

Prefer reliable verification with minimal duplicate compute and agent work. GitHub Actions is an execution option, not the definition of quality. Existing mandatory checks remain binding until an authorized policy change establishes an equivalent replacement.

## Establish the evidence boundary

Read relevant repository instructions, check commands, workflow triggers, and required-check settings when accessible. Distinguish documented requirements from settings verified live. Zero configured required checks does not mean zero release requirements.

Identify the candidate SHA, changes since accepted evidence, configuration changes, and available artifacts. An agent report remains reported evidence until inspected; inaccessible local paths are not a usable handoff. Name an invalidating change before reopening a closed finding or repeating verification. A new agent, branch, report or documentation commit alone does not invalidate product evidence.

## Choose sufficient verification

| Change or stage | Default action |
| --- | --- |
| Active implementation | Focused tests plus affected type, lint, build or integration checks; batch related corrections. |
| Frozen review/release candidate | Run the complete required quality and integration/browser checks once, or consume equivalent verified evidence already applicable to that candidate. |
| Later product/configuration delta | Rerun checks whose assumptions changed; broaden for affected dependencies or mandatory gates. |
| Documentation-only delta | Establish runtime/build equivalence once and validate documentation as needed. Preserve required-check reporting. |
| Billing/runtime outage | Record BLOCKED, retain evidence, and stop identical retries until the cause changes. |

Focused tests do not replace an unexecuted full suite. Build/deployment success does not prove lint, tests, browser journeys, authorization or release approval. Localhost browser tests are not hosted acceptance. Reuse hosted evidence only for unchanged behavior with explicit deployment/configuration binding.

## Reduce CI waste

For a GitHub Actions audit, read [references/optimise-github-actions.md](references/optimise-github-actions.md) and use the read-only collector `node scripts/measure.mjs OWNER/REPO --days 14 --out jobs.json` from this skill directory. Distinguish observed runner duration, estimated rounded runner minutes, quota consumption and actual invoice cost. Never call duration-derived estimates billed usage. Preserve the raw evidence and account for every run attempt; identify incomplete coverage and inaccessible billing settings.

Inspect workflow definitions and run history before attributing cost. Look for overlapping push/PR triggers, draft/docs runs, superseded jobs, repeated installation/builds, runner size, matrices, artifact retention and caching. Without billing evidence, label cost causes as hypotheses.

Prefer one intended trigger per change, branch/PR-scoped cancellation of superseded validation, sensible timeouts and expensive suites at a defined readiness point. Ensure draft-to-ready events trigger deferred checks. Reuse install/build outputs only where valid. Do not indiscriminately cancel deployments or migrations.

Path skips must not strand required checks pending or make omitted required work appear passed. Keep release-critical checks before an automatically deployed main merge. Before proposing self-hosted/external CI, account for infrastructure, maintenance, secrets, isolation and trusted status reporting; do not promise free operation. Verify current prices only when needed for an actual purchasing decision.

## Portable evidence and provider changes

Record each check/command, scope, full SHA or demonstrated tree equivalence, relevant runtime/configuration, result and exit status, accessible artifact, and whether new or reused. Hosted evidence also needs deployment ID and actual git binding. Redact credentials and private share tokens.

An alternative executor must run the required checks in a suitable reproducible environment with inspectable evidence. Before relying on it for release, reconcile branch protection, workflow policy and native gates with existing authority. Never invent a native Gate PASS or bypass mandatory gates. Changing executor does not authorize billing changes, merge, production or Shipping.

## Review and handoff

Separate code review, automated checks, hosted acceptance, composition, native gates and release authority. Use NEW PASS, REUSED PASS, REPORTED, NOT RUN and BLOCKED precisely. State limitations without launching another general audit.

If independent reviews are requested, use the same frozen candidate and evidence package with complementary scopes, such as code/invariants and evidence/landing readiness. Avoid duplicate full audits by default. Review conclusions do not substitute for required execution gates or human release authority.

Return: target; accepted evidence; invalidating delta; necessary checks; external blockers; permitted actions; stop condition. Carry existing authorization forward without asking again. This skill complements existing handoff instructions; installing it here does not install it in Cursor or modify repository settings. Provide portable context when cross-agent adoption is requested.
