---
name: steward
description: >
  SolvoBid CI budget. Keep PRs in draft while iterating, validate locally, batch pushes, and never
  spend GitHub Actions minutes on re-runs or cosmetic pushes. Use when pushing to any branch with
  an open PR and before acting on CI results.
---

# SolvoBid PR stewardship on a CI budget

GitHub Actions minutes are paid out of pocket. Earlier, about 3,000 minutes (about USD 50) went in
20 days, mostly on repeated full runs for draft PRs and for script- or docs-only follow-ups.
`quality.yml` runs a full `npm ci`, migrations, the whole Vitest suite on Postgres, lint, typecheck
and a build. `preview-smoke` then does a second install and build, installs Chromium and runs the
Playwright suites. Treat each CI run as expensive.

## When CI runs

`.github/workflows/quality.yml` runs:

- on pushes to `main`;
- on pull requests into `main` or `codex/**` that are **not drafts**;
- when dispatched manually.

Pushes to `cursor/**` branches do **not** run CI on their own. A Cursor branch gets CI only through
a non-draft PR into `main`.

On a draft PR, `quality` and `preview-smoke` show as **skipped**. That is expected and is not a CI
failure to fix. A newer push to the same PR cancels the running check.

## Rules

1. **Open PRs as drafts and keep them draft while iterating.** Review rounds, fix-ups and
   evidence updates all happen in draft, where CI costs nothing.
2. **Validate locally before every push** (commands below). A local pass is the gate for pushing a
   draft; CI is the final check before merge.
3. **Batch.** Push once per review round, with all of that round's fixes. Don't push only to
   refresh evidence, reword docs or record a review verdict. Fold those into the next code push,
   or put them in the PR description, which doesn't trigger CI.
4. **Leave "Ready for review" to the user**, unless they ask you to mark it. Marking ready starts
   the one CI run. From then on, every push costs a full run, so batch even harder.
5. **Once the PR is ready, red CI is real work.** Reproduce it locally, fix it, and push once.
6. **Never re-run a workflow, and never dispatch one, unless the user asks.** A job that ends
   within seconds with `runner_id: 0` and no steps means GitHub assigned no runner, usually
   because of billing or a spending limit. Tell the user once, with the job id, and don't retry.
7. **Stacked PRs** (base is another PR's branch) get no CI. Validate locally, and run CI only after
   retargeting to `main`.
8. **Docs changes are not free to skip.** Tests read files under `docs/` (for example
   `tests/operability-security.test.ts`). Run `npm test` for docs-only changes too.
9. **A PR opened before a workflow change** may not see a "Ready for review" event, because its
   merge ref still carries the old workflow. If marking it ready starts no run, merge `main` into
   the branch and push once. That brings the branch up to date and starts the one run.

## Local validation

```bash
# Once per environment
git fetch --unshallow || true          # drizzle-migrate-path needs full history
# Start Postgres 16 with user/password solvobid and database solvobid_test

export DATABASE_URL=postgresql://solvobid:solvobid@localhost:5432/solvobid_test NODE_ENV=test
npm ci
npm run db:guard
npx vitest run tests/drizzle-migrate-path.test.ts
npm run db:migrate
npm test
npm run lint
npm run typecheck                      # delete a stale .next/ first if it references other branches
(unset DATABASE_URL; npm run build)
```

For a change to the buyer-template styled-render checker, also run:

```bash
bash scripts/render-styled-layout-pages.sh
node scripts/check-styled-layout-render-selftest.mjs
```

These need the `libreoffice-writer` and `poppler-utils` packages.

Run the Playwright smoke suites locally only when the change touches UI routes or flows they
cover. They are the most expensive part of CI.

## Reporting

In the PR description, say which checks ran locally, on which commit, and their results. Don't
claim a CI result that didn't run.
