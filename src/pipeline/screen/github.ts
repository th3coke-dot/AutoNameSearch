import type { CompanyScreenResult } from "../types";

/**
 * GitHub organization collision check via public API.
 * GET https://api.github.com/orgs/{name} → 200 conflict, 404 clear.
 */
export async function screenGithubOrg(
  name: string,
  opts: { skipExternal?: boolean; token?: string } = {},
): Promise<CompanyScreenResult> {
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "");

  if (opts.skipExternal) {
    return {
      source: "github",
      status: "unchecked",
      matches: [],
      detail: "external screens skipped",
    };
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "AutoNameSearch/0.1",
    };
    const token = opts.token ?? process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/orgs/${encodeURIComponent(slug)}`, {
      headers,
      signal: AbortSignal.timeout(8_000),
    });

    if (res.status === 404) {
      // Also check users — org namespace collision with user login is still a problem
      const userRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(slug)}`,
        { headers, signal: AbortSignal.timeout(8_000) },
      );
      if (userRes.status === 404) {
        return { source: "github", status: "clear", matches: [] };
      }
      if (userRes.ok) {
        return {
          source: "github",
          status: "conflict",
          matches: [`github.com/${slug}`],
          detail: "GitHub user login taken",
        };
      }
      return {
        source: "github",
        status: "error",
        matches: [],
        detail: `user lookup HTTP ${userRes.status}`,
      };
    }

    if (res.ok) {
      return {
        source: "github",
        status: "conflict",
        matches: [`github.com/${slug}`],
        detail: "GitHub organization exists",
      };
    }

    if (res.status === 403 || res.status === 429) {
      return {
        source: "github",
        status: "error",
        matches: [],
        detail: "GitHub rate limited — set GITHUB_TOKEN",
      };
    }

    return {
      source: "github",
      status: "error",
      matches: [],
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      source: "github",
      status: "error",
      matches: [],
      detail: err instanceof Error ? err.message : "github screen failed",
    };
  }
}
