# AutoNameSearch

Venture-capital grade naming pipeline — Project #3 alongside Scope2Plan and PartnerForge.

Not a curated shortlist. A systematic funnel:

1. **Generate** — 50,000 weighted phonetic candidates (Scandinavian / engineering DNA)
2. **Filter** — length ≤8, pronunciation, triple consonants, repeated vowels, spelling
3. **Domains** — `.com` / `.ai` / `.io` via DNS + RDAP
4. **AI brand search** — web evidence + OpenAI collision judgment (no USPTO/EUIPO/WIPO keys)
5. **Companies** — Crunchbase, GitHub orgs/users, LinkedIn vanity
6. **Score** — enterprise feel, Scandinavian DNA, typography, pronunciation, memorability, investor appeal, logo potential, verb potential, ecosystem fit
7. **Rank** — shortlist table with domain / TM / enterprise / brand / total

## Quick start

```bash
npm install
cp .env.example .env   # add GITHUB_TOKEN + OPENAI_API_KEY
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

## API keys

| Variable | Unlocks |
|----------|---------|
| `GITHUB_TOKEN` | Higher GitHub rate limits for org/user checks |
| `OPENAI_API_KEY` | AI brand / trademark collision search |
| `OPENAI_MODEL` | Optional model override (default `gpt-4o-mini`) |
| `CRUNCHBASE_API_KEY` | Organization autocomplete conflicts |
| `LINKEDIN_ACCESS_TOKEN` | Company vanity lookup |

Without `OPENAI_API_KEY`, the brand-search stage falls back to web-snippet heuristics only.

Domains and GitHub work against public endpoints (GitHub is rate-limited without a token).

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
  screen/           # domain, AI trademark, github, company adapters
  scoring.ts        # brand dimensions → total
  orchestrator.ts   # end-to-end funnel
src/cli/run.ts      # CLI entry
src/app/            # Next.js UI + API
```
