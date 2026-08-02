import type { DomainResult, ScreenStatus } from "../types";

/**
 * Domain availability screening for .com / .ai / .io.
 *
 * Strategy (no paid registrar API required):
 * 1) Parallel DNS A + NS via dns.google
 * 2) RDAP only when DNS is empty (best-effort)
 */

async function dnsExists(hostname: string): Promise<boolean | null> {
  try {
    const [aRes, nsRes] = await Promise.all([
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(5_000),
      }),
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=NS`, {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(5_000),
      }),
    ]);

    if (aRes.ok) {
      const data = (await aRes.json()) as { Answer?: unknown[] };
      if (data.Answer && data.Answer.length > 0) return true;
    }
    if (nsRes.ok) {
      const data = (await nsRes.json()) as { Answer?: unknown[] };
      if (data.Answer && data.Answer.length > 0) return true;
    }
    if (!aRes.ok && !nsRes.ok) return null;
    return false;
  } catch {
    return null;
  }
}

async function rdapRegistered(domain: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(6_000),
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

  // Fast path: DNS says free — treat as clear without waiting on RDAP
  if (dns === false) {
    // Fire RDAP in parallel only to catch parked non-resolving domains
    const rdap = await rdapRegistered(domain);
    if (rdap === true) {
      return {
        tld,
        available: false,
        status: "conflict",
        detail: `${domain} found in RDAP`,
      };
    }
    return {
      tld,
      available: true,
      status: "clear",
      detail: `${domain} appears unregistered`,
    };
  }

  const rdap = await rdapRegistered(domain);
  if (rdap === true) {
    return {
      tld,
      available: false,
      status: "conflict",
      detail: `${domain} found in RDAP`,
    };
  }
  if (rdap === false) {
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
    status: toStatus(null),
    detail: `could not determine availability for ${domain}`,
  };
}

export async function checkDomains(
  name: string,
  tlds: string[],
  opts: { skipExternal?: boolean } = {},
): Promise<DomainResult[]> {
  return Promise.all(tlds.map((tld) => checkDomain(name, tld, opts)));
}

/** Keep names where ALL configured TLDs are clear (or unchecked in demo mode) */
export function domainsPass(results: DomainResult[], requireAllClear: boolean): boolean {
  if (!requireAllClear) {
    return results.every((r) => r.status === "clear" || r.status === "unchecked");
  }
  return results.every((r) => r.status === "clear");
}
