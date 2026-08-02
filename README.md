# AutoNameSearch

Venture-capital grade naming pipeline — Project #3 alongside Scope2Plan and PartnerForge.

Not a curated shortlist. A systematic funnel:

1. **Generate** — 50,000 weighted phonetic candidates (Scandinavian / engineering DNA)
2. **Filter** — length ≤8, pronunciation, triple consonants, repeated vowels, spelling
3. **Domains** — `.com` / `.ai` / `.io` via DNS + RDAP
4. **Trademarks** — USPTO heuristic + EUIPO / WIPO adapters (API keys)
5. **Companies** — Crunchbase, GitHub orgs/users, LinkedIn vanity
6. **Score** — enterprise feel, Scandinavian DNA, typography, pronunciation, memorability, investor appeal, logo potential, verb potential, ecosystem fit
7. **Rank** — shortlist table with domain / TM / enterprise / brand / total

## Quick start

```bash
npm install
cp .env.example .env   # optional API keys
npm run pipeline:demo  # offline-friendly run
npm run dev            # UI at http://localhost:3000
```

### Full CLI run

```bash
npm run pipeline -- --candidates 50000 --external-limit 2000
```

Flags:

| Flag | Default | Meaning |
|------|---------|---------|
| `--candidates` | `50000` | Phonetic generation size |
| `--external-limit` | `2000` | Max names sent to live screens |
| `--top` | `50` | Shortlist length |
| `--seed` | time | Reproducible generation |
| `--skip-external` | off | Demo mode (no live HTTP screens) |

Outputs JSON under `data/runs/` (including `latest.json` for the UI).

## API keys (optional)

| Variable | Unlocks |
|----------|---------|
| `GITHUB_TOKEN` | Higher GitHub rate limits |
| `CRUNCHBASE_API_KEY` | Organization autocomplete conflicts |
| `LINKEDIN_ACCESS_TOKEN` | Company vanity lookup |
| `EUIPO_CLIENT_ID` / `EUIPO_CLIENT_SECRET` | EUIPO adapter hook |
| `WIPO_API_KEY` | WIPO adapter hook |
| `USPTO_API_KEY` | Future USPTO Open Data wiring |

Without keys, the pipeline still runs: domains/GitHub use public endpoints where possible; EUIPO/WIPO/Crunchbase/LinkedIn stay **unchecked** rather than falsely clear.

> Automated screens are first-pass engineering signals — not legal trademark clearance.

## Scripts

```bash
npm run dev
npm run build
npm test
npm run pipeline
npm run pipeline:demo
```

## Architecture

```
src/pipeline/
  phonetics.ts      # weighted prefix / core / suffix generation
  filters.ts        # linguistic funnel
  screen/           # domain, trademark, github, company adapters
  scoring.ts        # brand dimensions → total
  orchestrator.ts   # end-to-end funnel
src/cli/run.ts      # CLI entry
src/app/            # Next.js UI + API
```
