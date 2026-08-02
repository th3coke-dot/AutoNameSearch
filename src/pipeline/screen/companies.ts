import type { CompanyScreenResult } from "../types";

/**
 * Crunchbase + LinkedIn company-name collision screens.
 * Both require API keys for reliable automation; without keys we stay honest.
 */

export async function screenCrunchbase(
  name: string,
  opts: { skipExternal?: boolean } = {},
): Promise<CompanyScreenResult> {
  if (opts.skipExternal) {
    return {
      source: "crunchbase",
      status: "unchecked",
      matches: [],
      detail: "external screens skipped",
    };
  }

  const key = process.env.CRUNCHBASE_API_KEY;
  if (!key) {
    return {
      source: "crunchbase",
      status: "unchecked",
      matches: [],
      detail: "CRUNCHBASE_API_KEY not configured",
    };
  }

  try {
    // Crunchbase Autocomplete (v4) — requires enterprise/basic key
    const url = `https://api.crunchbase.com/api/v4/autocompletes?query=${encodeURIComponent(name)}&collection_ids=organizations&limit=5&user_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        source: "crunchbase",
        status: "error",
        matches: [],
        detail: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      entities?: Array<{ identifier?: { value?: string; permalink?: string } }>;
    };
    const matches = (data.entities ?? [])
      .map((e) => e.identifier?.value)
      .filter((v): v is string => Boolean(v))
      .filter((v) => v.toLowerCase() === name.toLowerCase());

    return {
      source: "crunchbase",
      status: matches.length ? "conflict" : "clear",
      matches,
    };
  } catch (err) {
    return {
      source: "crunchbase",
      status: "error",
      matches: [],
      detail: err instanceof Error ? err.message : "crunchbase failed",
    };
  }
}

export async function screenLinkedIn(
  name: string,
  opts: { skipExternal?: boolean } = {},
): Promise<CompanyScreenResult> {
  if (opts.skipExternal) {
    return {
      source: "linkedin",
      status: "unchecked",
      matches: [],
      detail: "external screens skipped",
    };
  }

  const key = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!key) {
    // Soft public probe: company vanity URL often 404s when free — unreliable.
    // Prefer unchecked over false confidence.
    return {
      source: "linkedin",
      status: "unchecked",
      matches: [],
      detail: "LINKEDIN_ACCESS_TOKEN not configured",
    };
  }

  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const res = await fetch(
      `https://api.linkedin.com/v2/organizations?q=vanityName&vanityName=${encodeURIComponent(slug)}`,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.status === 404) {
      return { source: "linkedin", status: "clear", matches: [] };
    }
    if (!res.ok) {
      return {
        source: "linkedin",
        status: "error",
        matches: [],
        detail: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { elements?: unknown[] };
    const conflict = (data.elements?.length ?? 0) > 0;
    return {
      source: "linkedin",
      status: conflict ? "conflict" : "clear",
      matches: conflict ? [`linkedin.com/company/${slug}`] : [],
    };
  } catch (err) {
    return {
      source: "linkedin",
      status: "error",
      matches: [],
      detail: err instanceof Error ? err.message : "linkedin failed",
    };
  }
}
