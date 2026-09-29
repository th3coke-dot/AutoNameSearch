# Optimize GitHub Actions

Measure first, preserve verification, and change the largest demonstrated waste. Prefer cost reduction with acceptable developer feedback time; explain changes that exchange speed for cost.

## Baseline

Run `node scripts/measure.mjs OWNER/REPO --days 14 --out jobs.json` from the skill directory with authenticated `gh` and Actions read permission. The collector reads run/job APIs, including all attempts, and estimates rounded duration; it does not access invoices. Use `--input jobs.json` to summarize saved evidence without another API collection. Do not commit raw private job metadata into public repositories.

Inspect current billing exports/settings when available. Verify current runner pricing and included allowance rather than hardcoding multipliers. Legacy workflow timing endpoints are closing down and omit rounding/multipliers. Public standard runners, larger runners and self-hosted infrastructure have different cost rules. Report billing or plan access failures as unknown; a denied protection read does not prove no protections exist.

Read repository instructions, workflows, local/composite actions, triggers, concurrency, path filters, timeout settings, `needs`, required checks/rulesets and deployment consumers. Inspect `strict`, bypass/direct-push possibilities and what code the PR checks actually executed. Read workflow-contract tests using `rg`, not a broad new product audit.

## Prioritize

Rank workflow/event and jobs by observed duration and estimated rounded minutes, cancelled/failed work, setup repetition and branch run count. Inspect step timings of representative expensive runs. Compare median/p90 successful feedback time and the dependency critical path; summing parallel job durations measures compute, not latency. A heavily used filter may legitimately cover important shared dependencies.

Prefer cancelling superseded validation with PR-scoped concurrency, lockfile-keyed dependency caches, realistic timeouts and eliminating overlapping push/PR validation. Keep deployment/migration concurrency separate; never cancel those indiscriminately. Cache package downloads and validated build outputs with appropriate keys; do not trust untrusted-PR artifacts in privileged release jobs.

Consider combining tiny jobs only when setup/rounding savings justify slower feedback. Preserve individual failure reporting and the aggregate failure result; continue necessary sequential cases after failures without hiding any failed exit status. Retain parallelism for long jobs where feedback warrants it.

Defer expensive draft checks only with explicit draft-to-ready triggering (`ready_for_review`), fresh-head verification and an always-reported required gate that rejects missing, cancelled or failed mandatory work. Path-filtered workflows can leave required checks pending; conditionally skipped jobs may report success. Neither skipped state proves required work ran. Replay proposed filters over real PR file lists, including dependency/workflow changes. Do not treat docs or version bumps as harmless without inspecting build/config impact.

Do not remove main suites just because PR suites passed. Establish applicability to the integrated release tree, current base, runtime/config and deployment artifacts, including direct pushes and bypasses. Preserve mandatory pre-release verification. Main checks may detect composition regressions; an auto-deploy must not ship before required checks. Reuse evidence only with a recorded full SHA or demonstrated relevant equivalence.

Treat Docker inputs as their full dependency closure: `COPY . .` includes application source, not just the Dockerfile/lockfile. Validate the exact image/digest being released; retain build and publication requirements. Inspect cache export time and actual cache limits before tuning cache scope/mode.

Inspect bot and scheduled workloads individually; do not assume all bots use a particular event. Avoid changing operational cleanup frequency without understanding its service contract. Keep platform coverage for platform-sensitive paths. Self-hosting requires confirmed capacity, architecture, access, isolation, maintenance and total cost; it is not free infrastructure.

Merge queues verify integrated groups and require `merge_group` events. They do not automatically eliminate PR-push checks or run exactly once per merge; queue changes can rebuild groups. Verify current plan and organization eligibility before proposing one, and estimate from actual workflow behavior.

## Execute and report

Estimate changes by replaying the baseline: affected runs, omitted jobs, saved setup, changed selection and feedback critical path. Mark draft-dependent or unobserved savings unmeasured. Keep one concise table: change, estimated minutes, feedback impact and verification implications.

Apply small changes within existing owner authority; do not introduce a routine approval round for cache/timeout/cancellation fixes. Preserve check names and gate semantics, repository model requirements, product behavior and existing release authority. Do not weaken tests to pass. Install/update this policy separately from product or workflow changes when that keeps review clear.

Use actionlint for changed workflows and affected contract tests. Exercise required-gate cases: mandatory work failing, cancelled, absent, draft-to-ready and legitimate path skip. Use focused checks while editing and the complete mandatory suite once on the frozen candidate, or valid already-inspected evidence. Consume the automatic CI run instead of launching a duplicate. Do not trigger empty validation runs solely to prove installation.

Return baseline scope/coverage, top measured waste, changes, new/reused verification, predicted versus observed savings and remaining blockers. Stop when scope and mandatory gates pass. Shut down temporary processes. Schedule no recurring audit unless asked.
