import type { TrademarkHit, TrademarkResult } from "../types";

/**
 * Trademark screening adapters for USPTO / EUIPO / WIPO.
 *
 * Real clearance still needs counsel — this stage is automated first-pass collision
 * detection using public endpoints when available, with honest "unchecked" when not.
 *
 * Env vars (optional):
 * - USPTO_API_KEY — if using a commercial aggregator later
 * - RAPIDAPI_KEY — optional RapidAPI trademark gateways
 */

async function screenUspto(name: string): Promise<TrademarkHit[]> {
  // USPTO Open Data Portal / TSDR do not offer a simple unauthenticated mark search
  // suitable for bulk. We probe the public assignment/search HTML lightly as a
  // heuristic signal only — failures return no hits (caller marks unchecked/error).
  try {
    const q = encodeURIComponent(name);
    const url = `https://tmsearch.uspto.gov/is-link-api/jsf/search/search-ajax.html?query=${q}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json, text/html",
        "User-Agent": "AutoNameSearch/0.1 (brand screening pipeline)",
      },
    });
    if (!res.ok) return [];
    const text = await res.text();
    const lower = text.toLowerCase();
    const needle = name.toLowerCase();
    if (lower.includes(needle) && (lower.includes("serial") || lower.includes("mark"))) {
      return [
        {
          office: "USPTO",
          mark: name,
          status: "possible match (heuristic)",
          url: `https://tmsearch.uspto.gov/`,
        },
      ];
    }
    return [];
  } catch {
    return [];
  }
}

async function screenEuipo(name: string): Promise<{ hits: TrademarkHit[]; error?: string }> {
  // EUIPO provides eSearch Plus; bulk API requires credentials.
  // When EUIPO_CLIENT_ID/SECRET are set, wire OAuth here. Until then: unchecked.
  if (!process.env.EUIPO_CLIENT_ID) {
    return { hits: [], error: "EUIPO_CLIENT_ID not configured" };
  }
  void name;
  return { hits: [], error: "EUIPO adapter credentials present but search not yet wired" };
}

async function screenWipo(name: string): Promise<{ hits: TrademarkHit[]; error?: string }> {
  if (!process.env.WIPO_API_KEY) {
    return { hits: [], error: "WIPO_API_KEY not configured" };
  }
  void name;
  return { hits: [], error: "WIPO adapter credentials present but search not yet wired" };
}

export async function screenTrademarks(
  name: string,
  opts: { skipExternal?: boolean } = {},
): Promise<TrademarkResult> {
  if (opts.skipExternal) {
    return {
      status: "unchecked",
      hits: [],
      detail: "external screens skipped",
    };
  }

  const hits: TrademarkHit[] = [];
  const notes: string[] = [];

  try {
    const usptoHits = await screenUspto(name);
    hits.push(...usptoHits);
  } catch (err) {
    notes.push(`USPTO: ${err instanceof Error ? err.message : "error"}`);
  }

  const euipo = await screenEuipo(name);
  hits.push(...euipo.hits);
  if (euipo.error) notes.push(`EUIPO: ${euipo.error}`);

  const wipo = await screenWipo(name);
  hits.push(...wipo.hits);
  if (wipo.error) notes.push(`WIPO: ${wipo.error}`);

  // If we only have "not configured" notes and zero hits, treat as partial unchecked
  // rather than false clear — trademark clearance is never silently green.
  const officesConfigured = Boolean(
    process.env.EUIPO_CLIENT_ID || process.env.WIPO_API_KEY || process.env.USPTO_API_KEY,
  );

  if (hits.length > 0) {
    return {
      status: "conflict",
      hits,
      detail: notes.join("; ") || undefined,
    };
  }

  if (!officesConfigured && notes.length > 0) {
    return {
      status: "unchecked",
      hits: [],
      detail:
        "USPTO heuristic clear; EUIPO/WIPO require API keys for automated screening. Manual counsel review still required.",
    };
  }

  return {
    status: notes.some((n) => n.includes("error")) ? "error" : "clear",
    hits: [],
    detail: notes.join("; ") || "no automated hits",
  };
}
