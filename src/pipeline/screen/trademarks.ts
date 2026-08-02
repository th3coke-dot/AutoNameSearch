import type { TrademarkHit, TrademarkResult } from "../types";
import { mapPool } from "../util";

/**
 * AI brand / trademark collision search.
 *
 * 1) Fast web evidence (single DuckDuckGo query, high concurrency)
 * 2) Parallel OpenAI batch judgments (gpt-4.1-mini by default)
 *
 * First-pass engineering screen — not legal clearance.
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
  // gpt-4.1-mini: strong quality, low latency for structured JSON batches
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

/** Pull lightweight web evidence for a name (no API key). */
export async function searchWebEvidence(name: string): Promise<WebEvidence> {
  const q = `"${name}" (trademark OR brand OR company OR startup OR SaaS)`;
  const snippets: string[] = [];

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      headers: {
        "User-Agent": "AutoNameSearch/0.1 (brand collision research)",
        Accept: "text/html",
      },
    });
    if (res.ok) {
      const html = await res.text();
      const titles = [...html.matchAll(/class="result__a"[^>]*>(.*?)<\/a>/gi)].map((m) =>
        m[1]!.replace(/<[^>]+>/g, "").trim(),
      );
      const bodies = [
        ...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi),
      ].map((m) => m[1]!.replace(/<[^>]+>/g, "").trim());
      for (let i = 0; i < Math.min(5, Math.max(titles.length, bodies.length)); i++) {
        const line = [titles[i], bodies[i]].filter(Boolean).join(" — ");
        if (line) snippets.push(line.slice(0, 240));
      }
    }
  } catch {
    // best-effort
  }

  return { name, snippets: [...new Set(snippets)].slice(0, 6) };
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
    signal: AbortSignal.timeout(45_000),
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
    const hits: TrademarkHit[] = (
      judgment.relatedMarks.length ? judgment.relatedMarks : [name]
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
 * Web evidence in parallel, then concurrent OpenAI chunk judgments.
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

  // 1) Web evidence — high concurrency, single query per name
  let webDone = 0;
  const evidence = await mapPool(names, 16, async (name) => {
    const ev = await searchWebEvidence(name);
    webDone += 1;
    opts.onProgress?.(Math.floor((webDone / names.length) * names.length * 0.45), names.length);
    return ev;
  });

  const results: TrademarkResult[] = new Array(names.length);
  const key = openaiKey();

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
    }
    opts.onProgress?.(names.length, names.length);
    return results;
  }

  // 2) Parallel OpenAI batches — larger chunks, concurrent workers
  const chunkSize = 24;
  const chunks: Array<{ start: number; items: WebEvidence[] }> = [];
  for (let start = 0; start < evidence.length; start += chunkSize) {
    chunks.push({ start, items: evidence.slice(start, start + chunkSize) });
  }

  let aiDone = 0;
  await mapPool(chunks, 4, async (chunk) => {
    try {
      const judgments = await judgeBatchWithOpenAI(chunk.items);
      for (let j = 0; j < chunk.items.length; j++) {
        const idx = chunk.start + j;
        const ev = chunk.items[j]!;
        const fallback = heuristicFromSnippets(ev.name, ev.snippets);
        results[idx] = judgmentToResult(
          ev.name,
          judgments.get(ev.name.toLowerCase()),
          ev,
          fallback,
        );
      }
    } catch (err) {
      for (let j = 0; j < chunk.items.length; j++) {
        const idx = chunk.start + j;
        const ev = chunk.items[j]!;
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
    aiDone += chunk.items.length;
    opts.onProgress?.(
      Math.floor(names.length * 0.45) + Math.floor((aiDone / names.length) * names.length * 0.55),
      names.length,
    );
  });

  return results;
}
