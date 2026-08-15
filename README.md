# AutoNameSearch

Venture-capital grade naming pipeline — Project #3 alongside Scope2Plan and PartnerForge.

Not a curated shortlist. A systematic funnel:

1. **Brief** *(optional)* — one-liner, tone, must-feel / must-avoid, roots
2. **Generate** — context-weighted phonetic candidates  
   *or* **Vet** — paste a free-text name / list and run the same screens
3. **Filter** — length ≤8, pronunciation, triple consonants, repeated vowels, spelling
4. **Pre-score** — brief-aware brand ranking; only the strongest names hit live screens
5. **Domains** — `.com` / `.ai` / `.io` via parallel DNS + RDAP
6. **AI brand search** — parallel web evidence + `gpt-4.1-mini` batch judgments
7. **Companies** — Crunchbase, GitHub orgs/users, LinkedIn vanity
8. **Rank / verdict** — shortlist table, or strong / caution / reject for vetted names

## Quick start

```bash
npm install
cp .env.example .env   # add GITHUB_TOKEN + OPENAI_API_KEY
npm run pipeline:demo  # offline-friendly run
npm run dev            # UI at http://localhost:3000
```

### Full CLI run

```bash
npm run pipeline -- --candidates 50000 --external-limit 2000 \
  --one-liner "AI planning for engineering teams" \
  --tone nordic \
  --must-feel "precise, calm" \
  --must-avoid "playful, crypto" \
  --roots "plan, nor, syn"
```

Flags:

| Flag | Default | Meaning |
|------|---------|---------|
| `--candidates` | `50000` | Phonetic generation size |
| `--external-limit` | `2000` | Max names sent to live screens |
| `--top` | `50` | Shortlist length |
| `--seed` | time | Reproducible generation |
| `--skip-external` | off | Demo mode (no live HTTP screens) |
| `--one-liner` | | What the company does |
| `--tone` | `nordic` | `nordic` · `enterprise` · `industrial` · `soft` · `technical` |
| `--must-feel` | | Comma-separated qualities |
| `--must-avoid` | | Comma-separated avoid list |
| `--roots` | | Comma-separated syllable / metaphor roots |
| `--vet` | | Free-text name (or list) to vet instead of generating |

```bash
npm run pipeline -- --vet "Norvia" --tone nordic
npm run pipeline -- --vet "Norvia, Velion, Torix" --skip-external
```

Outputs JSON under `data/runs/` (including `latest.json` for the UI).

## API keys

| Variable | Unlocks |
|----------|---------|
| `GITHUB_TOKEN` | Higher GitHub rate limits for org/user checks |
| `OPENAI_API_KEY` | AI brand / trademark collision search |
| `OPENAI_MODEL` | Optional model override (default `gpt-4.1-mini`) |
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
