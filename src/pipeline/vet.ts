import { linguisticFilter } from "./filters";
import { checkDomains } from "./screen/domains";
import { screenTrademarksBatch } from "./screen/trademarks";
import { screenGithubOrg } from "./screen/github";
import { screenCrunchbase, screenLinkedIn } from "./screen/companies";
import { scoreBrand, totalScore } from "./scoring";
import { makeRunId, mapPool } from "./util";
import { normalizeContext, type NamingContext, EMPTY_CONTEXT } from "./context";
import type { ScoredName } from "./types";
import { DEFAULT_CONFIG } from "./types";

export type VetVerdict = "strong" | "caution" | "reject";

export interface VettedName extends ScoredName {
  linguisticOk: boolean;
  linguisticNotes: string[];
  verdict: VetVerdict;
  summary: string;
}

export interface VetResult {
  runId: string;
  createdAt: string;
  query: string;
  names: string[];
  context: NamingContext;
  skipExternal: boolean;
  results: VettedName[];
}

/** Parse free text into brand-like name tokens (max 20). */
export function parseFreeTextNames(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunks = /[,;\n]/.test(trimmed)
    ? trimmed.split(/[,;\n]+/)
    : [trimmed];

  const names = chunks
    .map((chunk) => {
      const letters = chunk.replace(/[^a-zA-Z]/g, "");
      if (letters.length < 2 || letters.length > 32) return "";
      return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
    })
    .filter(Boolean);

  return [...new Set(names)].slice(0, 20);
}

function verdictFor(row: ScoredName, linguisticOk: boolean): {
  verdict: VetVerdict;
  summary: string;
} {
  const issues: string[] = [];
  if (!linguisticOk) issues.push("linguistic flags");
  if (!row.domainOk) issues.push("domain conflicts");
  if (row.trademarks.status === "conflict") issues.push("brand/TM collision");
  if (row.companies.some((c) => c.status === "conflict")) {
    issues.push("company collision");
  }

  if (
    row.trademarks.status === "conflict" ||
    row.companies.some((c) => c.status === "conflict")
  ) {
    return {
      verdict: "reject",
      summary: `Likely reject — ${issues.join(", ")}.`,
    };
  }

  if (issues.length || row.trademarks.status === "error" || row.total < 70) {
    return {
      verdict: "caution",
      summary: issues.length
        ? `Proceed with caution — ${issues.join(", ")}.`
        : `Proceed with caution — brand score ${row.total}.`,
    };
  }

  return {
    verdict: "strong",
    summary: `Looks strong — domains clear, no hard collisions, score ${row.total}.`,
  };
}

export async function vetNames(
  query: string,
  opts: {
    skipExternal?: boolean;
    context?: Partial<NamingContext> | NamingContext;
    tlds?: string[];
  } = {},
): Promise<VetResult> {
  const context = normalizeContext(opts.context ?? EMPTY_CONTEXT);
  const skipExternal = opts.skipExternal ?? false;
  const tlds = opts.tlds ?? DEFAULT_CONFIG.tlds;
  const names = parseFreeTextNames(query);

  if (!names.length) {
    return {
      runId: makeRunId(),
      createdAt: new Date().toISOString(),
      query,
      names: [],
      context,
      skipExternal,
      results: [],
    };
  }

  const ling = linguisticFilter(names, 32);
  const rejectMap = new Map(ling.rejected.map((r) => [r.name.toLowerCase(), r.reason]));

  const domainEntries = await mapPool(names, skipExternal ? 10 : 6, async (name) => {
    const domains = await checkDomains(name, tlds, { skipExternal });
    return { name, domains };
  });

  const tmResults = await screenTrademarksBatch(
    domainEntries.map((e) => e.name),
    { skipExternal, context },
  );

  const companyEntries = await mapPool(
    domainEntries,
    skipExternal ? 10 : 6,
    async (entry, i) => {
      const [crunchbase, github, linkedin] = await Promise.all([
        screenCrunchbase(entry.name, { skipExternal }),
        screenGithubOrg(entry.name, { skipExternal }),
        screenLinkedIn(entry.name, { skipExternal }),
      ]);
      return {
        ...entry,
        trademarks: tmResults[i]!,
        companies: [crunchbase, github, linkedin],
      };
    },
  );

  const results: VettedName[] = companyEntries.map((entry) => {
    const scores = scoreBrand(entry.name, context);
    const total = totalScore(scores, context);
    const domainOk =
      entry.domains.every((d) => d.status === "clear") ||
      (skipExternal && entry.domains.every((d) => d.status === "unchecked"));
    const trademarkOk = entry.trademarks.status === "clear";
    const companyOk = entry.companies.every(
      (c) => c.status === "clear" || c.status === "unchecked",
    );
    const linguisticNotes: string[] = [];
    const reason = rejectMap.get(entry.name.toLowerCase());
    if (reason) linguisticNotes.push(reason);
    // Also note if name longer than generator max
    if (entry.name.length > DEFAULT_CONFIG.maxLength) {
      linguisticNotes.push(`longer than typical brand max (${DEFAULT_CONFIG.maxLength})`);
    }
    const linguisticOk = linguisticNotes.length === 0;

    const scored: ScoredName = {
      name: entry.name,
      domains: entry.domains,
      trademarks: entry.trademarks,
      companies: entry.companies,
      scores,
      total,
      domainOk,
      trademarkOk,
      companyOk,
    };
    const { verdict, summary } = verdictFor(scored, linguisticOk);

    return {
      ...scored,
      linguisticOk,
      linguisticNotes,
      verdict,
      summary,
    };
  });

  return {
    runId: makeRunId(),
    createdAt: new Date().toISOString(),
    query,
    names,
    context,
    skipExternal,
    results,
  };
}
