import type { DomainResult, ScreenStatus } from "../types";

/**
 * Domain availability screening for .com / .ai / .io.
 *
 * Strategy (no paid registrar API required):
 * 1) DNS A/AAAA/NS/CNAME lookup via dns.google JSON API
 * 2) If DNS empty, RDAP query (best-effort) to distinguish unregistered vs parked
 *
 * When skipExternal=true, marks unchecked so the pipeline still runs offline.
 */

async function dnsExists(hostname: string): Promise<boolean | null> {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`;
    const res = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Status?: number;
      Answer?: Array<{ type: number }>;
    };
    // Status 0 = NOERROR; answers present ⇒ likely registered/resolving
    if (data.Answer && data.Answer.length > 0) return true;
    // Also try NS
    const nsUrl = `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=NS`;
    const nsRes = await fetch(nsUrl, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!nsRes.ok) return null;
    const nsData = (await nsRes.json()) as { Answer?: unknown[] };
    if (nsData.Answer && nsData.Answer.length > 0) return true;
    return false;
  } catch {
    return null;
  }
}

async function rdapRegistered(domain: string): Promise<boolean | null> {
  try {
    // RDAP bootstrap via rdap.org redirector
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
      headers: { Accept: "application/rdap+json, application/json" },
    });
    if (res.status === 404) return false;
    if (res.status === 200) return true;
    return null;
  } catch {
    return null;
  }
}

function toStatus(available: boolean | null): ScreenStatus {
  if (available === true) return "clear";
  if (available === false) return "conflict";
  return "error";
}

export async function checkDomain(
  name: string,
  tld: string,
  opts: { skipExternal?: boolean } = {},
): Promise<DomainResult> {
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const domain = `${slug}.${tld}`;

  if (opts.skipExternal) {
    return {
      tld,
      available: null,
      status: "unchecked",
      detail: "external screens skipped",
    };
  }

  const dns = await dnsExists(domain);
  if (dns === true) {
    return {
      tld,
      available: false,
      status: "conflict",
      detail: `${domain} resolves via DNS`,
    };
  }

  // DNS empty — confirm with RDAP when possible
  const rdap = await rdapRegistered(domain);
  if (rdap === true) {
    return {
      tld,
      available: false,
      status: "conflict",
      detail: `${domain} found in RDAP`,
    };
  }
  if (rdap === false || dns === false) {
    return {
      tld,
      available: true,
      status: "clear",
      detail: `${domain} appears unregistered`,
    };
  }

  return {
    tld,
    available: null,
    status: "error",
    detail: `could not determine availability for ${domain}`,
  };
}

export async function checkDomains(
  name: string,
  tlds: string[],
  opts: { skipExternal?: boolean } = {},
): Promise<DomainResult[]> {
  const results: DomainResult[] = [];
  for (const tld of tlds) {
    results.push(await checkDomain(name, tld, opts));
    // polite pacing for public resolvers
    if (!opts.skipExternal) {
      await new Promise((r) => setTimeout(r, 40));
    }
  }
  return results;
}

/** Keep names where ALL configured TLDs are clear (or unchecked in demo mode) */
export function domainsPass(results: DomainResult[], requireAllClear: boolean): boolean {
  if (!requireAllClear) {
    return results.every((r) => r.status === "clear" || r.status === "unchecked");
  }
  return results.every((r) => r.status === "clear");
}
