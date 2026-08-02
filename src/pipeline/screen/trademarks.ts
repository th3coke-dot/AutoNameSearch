import type { TrademarkHit, TrademarkResult } from "../types";

/**
 * AI brand / trademark collision search.
 *
 * Replaces USPTO / EUIPO / WIPO API adapters with:
 * 1) Web search snippets (DuckDuckGo HTML — no key)
 * 2) OpenAI judgment of conflict risk (OPENAI_API_KEY)
 *
 * This is a first-pass engineering screen, not legal clearance.
 */

export type AiTrademarkJudgment = {
  name: string;
  conflict: boolean;
  confidence: number;
  reason: string;
  relatedMarks: string[];
};

type WebEvidence = {
  name: string;
  snippets: string[];
};

function openaiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

function openaiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/** Pull lightweight web evidence for a name (no API key). */
export async function searchWebEvidence(name: string): Promise<WebEvidence> {
  const queries = [
    `"${name}" trademark OR brand OR company`,
    `"${name}" startup OR SaaS OR software`,
  ];
  const snippets: string[] = [];

  for (const q of queries) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: {
          "User-Agent": "AutoNameSearch/0.1 (brand collision research)",
          Accept: "text/html",
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const titles = [...html.matchAll(/class="result__a"[^>]*>(.*?)<\/a>/gi)].map((m) =>
        m[1]!.replace(/<[^>]+>/g, "").trim(),
      );
      const bodies = [...html.matchAll(/class="result__snippet"[^>]*>(.*?)<\/a>?/gi)].map((m) =>
        m[1]!.replace(/<[^>]+>/g, "").trim(),
      );
      for (let i = 0; i < Math.min(4, Math.max(titles.length, bodies.length)); i++) {
        const line = [titles[i], bodies[i]].filter(Boolean).join(" — ");
        if (line) snippets.push(line.slice(0, 280));
      }
    } catch {
      // best-effort
    }
  }

  return { name, snippets: [...new Set(snippets)].slice(0, 8) };
}

function heuristicFromSnippets(name: string, snippets: string[]): TrademarkResult {
  const lower = name.toLowerCase();
  const hits: TrademarkHit[] = [];
  const conflictWords = ["trademark", "®", "inc.", "ltd", "gmbh", "official site", "company"];

  for (const sn of snippets) {
    const s = sn.toLowerCase();
    if (!s.includes(lower)) continue;
    const strong = conflictWords.some((w) => s.includes(w));
    if (strong) {
      hits.push({
        office: "AI",
        mark: name,
        status: "possible web collision",
        url: undefined,
      });
      break;
    }
  }

  if (hits.length) {
    return {
      status: "conflict",
      hits,
      detail: `Web evidence suggests existing use: ${snippets[0]}`,
    };
  }

  return {
    status: snippets.length ? "clear" : "unchecked",
    hits: [],
    detail: snippets.length
      ? "Web search found no strong brand/trademark collision signals"
      : "No web evidence gathered",
  };
}

async function judgeBatchWithOpenAI(
  batch: WebEvidence[],
): Promise<Map<string, AiTrademarkJudgment>> {
  const key = openaiKey();
  if (!key) return new Map();

  const payload = batch.map((b) => ({
    name: b.name,
    evidence: b.snippets,
  }));

  const system = `You are a brand collision analyst for a venture naming pipeline.
For each candidate name, decide if it likely conflicts with an existing company, product, or trademark in tech/SaaS/enterprise.
Use the web evidence plus your knowledge. Be conservative on exact/near-exact famous matches; ignore weak coincidences.
Return ONLY valid JSON: {"results":[{"name":"...","conflict":true|false,"confidence":0-1,"reason":"...","relatedMarks":["..."]}]}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openaiModel(),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            candidates: payload,
            instruction:
              "Mark conflict=true only for meaningful brand/trademark collisions a founder should reject.",
          }),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { results?: AiTrademarkJudgment[] };
  const map = new Map<string, AiTrademarkJudgment>();
  for (const row of parsed.results ?? []) {
    if (row?.name) map.set(row.name.toLowerCase(), row);
  }
  return map;
}

function judgmentToResult(
  name: string,
  judgment: AiTrademarkJudgment | undefined,
  evidence: WebEvidence,
  fallback: TrademarkResult,
): TrademarkResult {
  if (!judgment) return fallback;

  if (judgment.conflict) {
    const hits: TrademarkHit[] = (judgment.relatedMarks.length
      ? judgment.relatedMarks
      : [name]
    ).map((mark) => ({
      office: "AI" as const,
      mark,
      status: `AI conflict (${Math.round(judgment.confidence * 100)}%)`,
    }));
    return {
      status: "conflict",
      hits,
      detail: judgment.reason,
    };
  }

  return {
    status: "clear",
    hits: [],
    detail:
      judgment.reason ||
      (evidence.snippets.length
        ? "AI + web search: no meaningful collision"
        : "AI knowledge screen: no meaningful collision"),
  };
}

/** Screen one name (used by tests / ad-hoc). Prefer screenTrademarksBatch in the funnel. */
export async function screenTrademarks(
  name: string,
  opts: { skipExternal?: boolean } = {},
): Promise<TrademarkResult> {
  const [result] = await screenTrademarksBatch([name], opts);
  return (
    result ?? {
      status: "error",
      hits: [],
      detail: "empty batch",
    }
  );
}

/**
 * Batch AI trademark / brand search.
 * Gathers web evidence in parallel, then judges in OpenAI chunks.
 */
export async function screenTrademarksBatch(
  names: string[],
  opts: { skipExternal?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<TrademarkResult[]> {
  if (opts.skipExternal) {
    return names.map(() => ({
      status: "unchecked" as const,
      hits: [],
      detail: "external screens skipped",
    }));
  }

  if (!names.length) return [];

  // 1) Web evidence
  const evidence: WebEvidence[] = [];
  const concurrency = 4;
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < names.length) {
      const i = cursor++;
      const name = names[i]!;
      evidence[i] = await searchWebEvidence(name);
      done += 1;
      // progress is half web / half AI conceptually — report web phase as 0–50%
      opts.onProgress?.(Math.floor(done / 2), names.length);
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, names.length) }, () => worker()),
  );

  // 2) AI judgment (or web heuristic fallback)
  const key = openaiKey();
  const results: TrademarkResult[] = new Array(names.length);
  const chunkSize = 12;

  if (!key) {
    for (let i = 0; i < names.length; i++) {
      const ev = evidence[i]!;
      const heuristic = heuristicFromSnippets(ev.name, ev.snippets);
      results[i] = {
        ...heuristic,
        detail:
          (heuristic.detail ? `${heuristic.detail}. ` : "") +
          "OPENAI_API_KEY not set — used web heuristic only.",
      };
      opts.onProgress?.(Math.floor(names.length / 2) + Math.floor((i + 1) / 2), names.length);
    }
    return results;
  }

  for (let start = 0; start < evidence.length; start += chunkSize) {
    const chunk = evidence.slice(start, start + chunkSize);
    try {
      const judgments = await judgeBatchWithOpenAI(chunk);
      for (let j = 0; j < chunk.length; j++) {
        const idx = start + j;
        const ev = chunk[j]!;
        const fallback = heuristicFromSnippets(ev.name, ev.snippets);
        results[idx] = judgmentToResult(
          ev.name,
          judgments.get(ev.name.toLowerCase()),
          ev,
          fallback,
        );
      }
    } catch (err) {
      for (let j = 0; j < chunk.length; j++) {
        const idx = start + j;
        const ev = chunk[j]!;
        const fallback = heuristicFromSnippets(ev.name, ev.snippets);
        results[idx] = {
          ...fallback,
          status: fallback.status === "conflict" ? "conflict" : "error",
          detail: `${fallback.detail ?? "AI unavailable"} · ${
            err instanceof Error ? err.message : "OpenAI error"
          }`,
        };
      }
    }
    opts.onProgress?.(
      Math.floor(names.length / 2) + Math.floor(Math.min(start + chunkSize, names.length) / 2),
      names.length,
    );
  }

  return results;
}
