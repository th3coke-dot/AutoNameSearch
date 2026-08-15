import { generateCandidates } from "./phonetics";
import { linguisticFilter } from "./filters";
import { checkDomains, domainsPass } from "./screen/domains";
import { screenTrademarksBatch } from "./screen/trademarks";
import { screenGithubOrg } from "./screen/github";
import { screenCrunchbase, screenLinkedIn } from "./screen/companies";
import { rankNames, scoreBrand, totalScore } from "./scoring";
import { makeRunId, mapPool } from "./util";
import {
  contextIsActive,
  contextSummary,
  normalizeContext,
} from "./context";
import {
  DEFAULT_CONFIG,
  type PipelineConfig,
  type PipelineResult,
  type PipelineStageStats,
  type ScoredName,
} from "./types";

export type ProgressEvent = {
  stage: string;
  message: string;
  done?: number;
  total?: number;
};

export async function runPipeline(
  partial: Partial<PipelineConfig> = {},
  onProgress?: (e: ProgressEvent) => void,
): Promise<PipelineResult> {
  const config: PipelineConfig = {
    ...DEFAULT_CONFIG,
    ...partial,
    context: normalizeContext(partial.context ?? DEFAULT_CONFIG.context),
  };
  const stages: PipelineStageStats[] = [];
  const runId = makeRunId();
  const emit = (stage: string, message: string, done?: number, total?: number) =>
    onProgress?.({ stage, message, done, total });
  const ctx = config.context;

  // ── Step 1: Generate ──────────────────────────────
  let t0 = Date.now();
  emit("generate", `Generating ${config.candidateCount.toLocaleString()} candidates…`);
  const generated = generateCandidates(
    config.candidateCount,
    config.seed ?? Date.now() % 1_000_000_000,
    ctx,
  );
  stages.push({
    name: "generate",
    input: config.candidateCount,
    output: generated.length,
    rejected: Math.max(0, config.candidateCount - generated.length),
    durationMs: Date.now() - t0,
    notes: contextIsActive(ctx)
      ? `context-weighted phonetics · ${contextSummary(ctx)}`
      : "weighted Scandinavian / engineering phonetics",
  });

  // ── Step 2: Linguistic filter ─────────────────────
  t0 = Date.now();
  emit("filter", "Applying linguistic filters…");
  const filtered = linguisticFilter(generated, config.maxLength);
  stages.push({
    name: "linguistic",
    input: generated.length,
    output: filtered.kept.length,
    rejected: filtered.rejected.length,
    durationMs: Date.now() - t0,
    notes: "≤8 letters, pronunciation, triple consonants, double vowels, spelling",
  });

  // ── Step 2b: Pre-score so external screens hit the strongest names ─
  t0 = Date.now();
  emit("prescore", "Pre-scoring brand dimensions…");
  const preScored = filtered.kept.map((name) => {
    const scores = scoreBrand(name, ctx);
    return { name, scores, total: totalScore(scores, ctx) };
  });
  preScored.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const forExternal = preScored.slice(0, config.externalLimit);
  stages.push({
    name: "prescore",
    input: filtered.kept.length,
    output: forExternal.length,
    rejected: Math.max(0, filtered.kept.length - forExternal.length),
    durationMs: Date.now() - t0,
    notes: "deep-screen only the top brand-scored candidates",
  });

  // ── Step 3: Domains ───────────────────────────────
  t0 = Date.now();
  emit("domains", `Screening domains (${config.tlds.join(", ")})…`, 0, forExternal.length);

  const domainEntries = await mapPool(
    forExternal,
    config.skipExternal ? 32 : 12,
    async (row) => {
      const domains = await checkDomains(row.name, config.tlds, {
        skipExternal: config.skipExternal,
      });
      return { ...row, domains };
    },
    (done, total) => emit("domains", `Domain screen ${done}/${total}`, done, total),
  );

  const afterDomain = domainEntries.filter((e) =>
    domainsPass(e.domains, !config.skipExternal),
  );
  stages.push({
    name: "domains",
    input: forExternal.length,
    output: afterDomain.length,
    rejected: forExternal.length - afterDomain.length,
    durationMs: Date.now() - t0,
    notes: config.skipExternal
      ? "skipped (demo) — all treated as unchecked/pass"
      : "require clear .com + .ai + .io (parallel DNS)",
  });

  // ── Step 4: AI brand / trademark search ───────────────────────────
  t0 = Date.now();
  emit(
    "trademarks",
    "AI brand search (parallel web + OpenAI)…",
    0,
    afterDomain.length,
  );

  const tmResults = await screenTrademarksBatch(
    afterDomain.map((e) => e.name),
    {
      skipExternal: config.skipExternal,
      context: ctx,
      onProgress: (done, total) =>
        emit("trademarks", `AI brand search ${done}/${total}`, done, total),
    },
  );
  const tmEntries = afterDomain.map((entry, i) => ({
    ...entry,
    trademarks: tmResults[i]!,
  }));

  const afterTm = tmEntries.filter((e) => e.trademarks.status !== "conflict");
  stages.push({
    name: "trademarks",
    input: afterDomain.length,
    output: afterTm.length,
    rejected: afterDomain.length - afterTm.length,
    durationMs: Date.now() - t0,
    notes: config.skipExternal
      ? "skipped (demo)"
      : "AI + web collision screen; not legal clearance",
  });

  // ── Steps 5–7: Company screens (Crunchbase, GitHub, LinkedIn) ─────
  t0 = Date.now();
  emit("companies", "Screening Crunchbase / GitHub / LinkedIn…", 0, afterTm.length);

  const companyEntries = await mapPool(
    afterTm,
    config.skipExternal ? 32 : 10,
    async (entry) => {
      const [crunchbase, github, linkedin] = await Promise.all([
        screenCrunchbase(entry.name, { skipExternal: config.skipExternal }),
        screenGithubOrg(entry.name, { skipExternal: config.skipExternal }),
        screenLinkedIn(entry.name, { skipExternal: config.skipExternal }),
      ]);
      return { ...entry, companies: [crunchbase, github, linkedin] };
    },
    (done, total) => emit("companies", `Company screen ${done}/${total}`, done, total),
  );

  const afterCompany = companyEntries.filter(
    (e) => !e.companies.some((c) => c.status === "conflict"),
  );
  stages.push({
    name: "companies",
    input: afterTm.length,
    output: afterCompany.length,
    rejected: afterTm.length - afterCompany.length,
    durationMs: Date.now() - t0,
    notes: "Crunchbase + GitHub orgs/users + LinkedIn vanity",
  });

  // ── Step 8: Final rank (reuse pre-scores) ─────────────────────
  t0 = Date.now();
  emit("score", "Ranking shortlist…");

  const scored: ScoredName[] = afterCompany.map((entry) => {
    const domainOk =
      entry.domains.every((d) => d.status === "clear") ||
      (config.skipExternal && entry.domains.every((d) => d.status === "unchecked"));
    const trademarkOk = entry.trademarks.status === "clear";
    const companyOk = entry.companies.every(
      (c) => c.status === "clear" || c.status === "unchecked",
    );

    return {
      name: entry.name,
      domains: entry.domains,
      trademarks: entry.trademarks,
      companies: entry.companies,
      scores: entry.scores,
      total: entry.total,
      domainOk,
      trademarkOk,
      companyOk,
    };
  });

  const shortlist = rankNames(scored).slice(0, config.topN);
  stages.push({
    name: "score",
    input: afterCompany.length,
    output: shortlist.length,
    rejected: Math.max(0, afterCompany.length - shortlist.length),
    durationMs: Date.now() - t0,
    notes: "enterprise · scandi · type · sound · memory · investor · logo · verb · ecosystem",
  });

  emit("done", `Shortlist ready — top ${shortlist.length}`);

  return {
    runId,
    createdAt: new Date().toISOString(),
    config,
    stages,
    shortlist,
    totals: {
      generated: generated.length,
      afterLinguistic: filtered.kept.length,
      afterDomain: afterDomain.length,
      afterTrademark: afterTm.length,
      afterCompany: afterCompany.length,
      scored: scored.length,
    },
  };
}
