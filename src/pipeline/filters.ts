/**
 * Linguistic / brandability filters.
 * 50k → ~8k funnel step.
 *
 * "Double vowels" means repeated same vowel (aa/ee/oo…), not diphthongs (ia/io)
 * — the brief's example shortlist (Norvia, Velion, Corion) requires that reading.
 */

const VOWELS = new Set("aeiouyæøå");
const HARD_CLUSTERS = [
  "xxx",
  "zzz",
  "qq",
  "bx",
  "cx",
  "gx",
  "hx",
  "jx",
  "kx",
  "mx",
  "nx",
  "px",
  "qx",
  "sx",
  "tx",
  "wx",
  "vxz",
  "rvr",
  "lvl",
];

export interface FilterReject {
  name: string;
  reason: string;
}

export interface FilterResult {
  kept: string[];
  rejected: FilterReject[];
}

function hasDifficultPronunciation(name: string): boolean {
  const lower = name.toLowerCase();

  if (![...lower].some((c) => VOWELS.has(c))) return true;
  if (/(bg|gk|pk|tk|dq|zq)$/i.test(lower)) return true;

  const consonants = [...lower].filter((c) => /[a-z]/.test(c) && !VOWELS.has(c));
  if (consonants.length / lower.length > 0.72) return true;

  for (const cluster of HARD_CLUSTERS) {
    if (lower.includes(cluster)) return true;
  }

  if (/^[bcdfghjklmnpqrstvwxz]{2}[aeiou][bcdfghjklmnpqrstvwxz]{3}/i.test(lower)) {
    return true;
  }

  return false;
}

function isDifficultSpelling(name: string): boolean {
  const lower = name.toLowerCase();
  // Naked q outside brand-y iq/xq patterns
  if (/q/i.test(lower) && !/iq|xq|qu/i.test(lower)) return true;
  if (/[jz]{2}/i.test(lower)) return true;
  if (/w[bcdfgjklmnpqstvwxz]/i.test(lower)) return true;
  return false;
}

export function linguisticFilter(
  names: string[],
  maxLength = 8,
): FilterResult {
  const kept: string[] = [];
  const rejected: FilterReject[] = [];
  const seen = new Set<string>();

  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();

    if (seen.has(key)) {
      rejected.push({ name, reason: "duplicate" });
      continue;
    }
    seen.add(key);

    if (name.length > maxLength) {
      rejected.push({ name, reason: `longer than ${maxLength}` });
      continue;
    }
    if (name.length < 4) {
      rejected.push({ name, reason: "shorter than 4" });
      continue;
    }

    if (/[^a-z]/i.test(name)) {
      rejected.push({ name, reason: "invalid characters" });
      continue;
    }

    if (/[bcdfghjklmnpqrstvwxz]{3,}/i.test(name)) {
      rejected.push({ name, reason: "triple consonants" });
      continue;
    }

    // Repeated same vowel (aa, ee, …) — diphthongs like ia/io are allowed
    if (/([aeiou])\1/i.test(name)) {
      rejected.push({ name, reason: "double vowels" });
      continue;
    }

    // Triple vowel runs (aio, eio…) — hard to brand
    if (/[aeiouy]{3,}/i.test(name)) {
      rejected.push({ name, reason: "triple vowels" });
      continue;
    }

    if (/(.)\1\1/i.test(name)) {
      rejected.push({ name, reason: "triple letter" });
      continue;
    }

    if (hasDifficultPronunciation(name)) {
      rejected.push({ name, reason: "difficult pronunciation" });
      continue;
    }
    if (isDifficultSpelling(name)) {
      rejected.push({ name, reason: "difficult spelling" });
      continue;
    }

    kept.push(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());
  }

  return { kept, rejected };
}
