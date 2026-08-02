/**
 * Weighted phonetic building blocks — Scandinavian / engineering DNA.
 * Generation is designed, not random dictionary mashups.
 */

export const PREFIXES: Array<{ value: string; weight: number }> = [
  { value: "Nor", weight: 12 },
  { value: "Norv", weight: 8 },
  { value: "Nord", weight: 10 },
  { value: "Bor", weight: 7 },
  { value: "Val", weight: 9 },
  { value: "Ver", weight: 10 },
  { value: "Vor", weight: 8 },
  { value: "Kor", weight: 9 },
  { value: "Kar", weight: 7 },
  { value: "Or", weight: 6 },
  { value: "Ar", weight: 8 },
  { value: "Lin", weight: 9 },
  { value: "Lyn", weight: 8 },
  { value: "Vel", weight: 10 },
  { value: "Tre", weight: 8 },
  { value: "Mer", weight: 8 },
  { value: "Tor", weight: 10 },
  { value: "Cor", weight: 9 },
  { value: "Ax", weight: 6 },
  { value: "Sk", weight: 5 },
  { value: "Fj", weight: 4 },
  { value: "El", weight: 6 },
  { value: "Om", weight: 5 },
  { value: "Hex", weight: 4 },
  { value: "Ny", weight: 5 },
];

export const CORES: Array<{ value: string; weight: number }> = [
  { value: "vi", weight: 12 },
  { value: "ve", weight: 10 },
  { value: "va", weight: 9 },
  { value: "xo", weight: 7 },
  { value: "xa", weight: 6 },
  { value: "li", weight: 10 },
  { value: "lo", weight: 8 },
  { value: "na", weight: 9 },
  { value: "ra", weight: 10 },
  { value: "ri", weight: 10 },
  { value: "vo", weight: 9 },
  { value: "cor", weight: 7 },
  { value: "tor", weight: 8 },
  { value: "ven", weight: 9 },
  { value: "vor", weight: 8 },
  { value: "xis", weight: 6 },
  { value: "via", weight: 10 },
  { value: "nex", weight: 7 },
  { value: "syn", weight: 6 },
  { value: "lum", weight: 7 },
  { value: "dra", weight: 6 },
  { value: "kai", weight: 5 },
  { value: "ony", weight: 5 },
];

export const SUFFIXES: Array<{ value: string; weight: number }> = [
  { value: "is", weight: 11 },
  { value: "iq", weight: 8 },
  { value: "ix", weight: 10 },
  { value: "ium", weight: 6 },
  { value: "io", weight: 10 },
  { value: "or", weight: 11 },
  { value: "on", weight: 12 },
  { value: "ia", weight: 10 },
  { value: "os", weight: 8 },
  { value: "us", weight: 7 },
  { value: "a", weight: 6 },
  { value: "en", weight: 7 },
  { value: "um", weight: 5 },
  { value: "yx", weight: 4 },
  { value: "el", weight: 6 },
];

/** Mulberry32 — deterministic PRNG for reproducible runs */
export function createRng(seed = 1): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(
  items: Array<{ value: string; weight: number }>,
  rng: () => number,
): string {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1]!.value;
}

function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

const VOWEL_RE = /[aeiouy]/i;

function endsWithVowel(s: string): boolean {
  return VOWEL_RE.test(s.slice(-1));
}

function startsWithVowel(s: string): boolean {
  return VOWEL_RE.test(s.charAt(0));
}

/** Reject clumsy seam assemblies before they enter the funnel */
function isWellFormed(raw: string): boolean {
  const s = raw.toLowerCase();
  if (s.length < 4 || s.length > 10) return false;
  // Triple+ vowel runs (Torxaio → aio)
  if (/[aeiouy]{3,}/i.test(s)) return false;
  // Prefix/core seam producing repeated consonant digraph noise
  if (/(.)\1/i.test(s)) return false;
  // Awkward x + vowel-heavy tails
  if (/x[aeiou]{2}/i.test(s)) return false;
  // Same syllable stutter (tor + tor)
  if (/(.{2,3})\1/i.test(s)) return false;
  return true;
}

/**
 * Assemble prefix + optional core + suffix with seam-aware joining.
 * Patterns: Prefix+Suffix | Prefix+Core+Suffix
 */
export function generateCandidates(
  count: number,
  seed = Date.now() % 1_000_000_000,
): string[] {
  const rng = createRng(seed);
  const out = new Set<string>();
  let guard = 0;
  const maxAttempts = count * 40;

  while (out.size < count && guard < maxAttempts) {
    guard += 1;
    const prefix = pickWeighted(PREFIXES, rng);
    // Prefer Prefix+Suffix for cleaner 5–7 letter brands; cores less often
    const useCore = rng() < 0.45;
    let core = useCore ? pickWeighted(CORES, rng) : "";
    const suffix = pickWeighted(SUFFIXES, rng);

    // Drop core when it stacks vowels at either seam
    if (
      core &&
      ((endsWithVowel(prefix) && startsWithVowel(core)) ||
        (endsWithVowel(core) && startsWithVowel(suffix)))
    ) {
      // Often better without the core than with a diphthong pile-up
      if (rng() < 0.7) core = "";
    }

    // Avoid prefix ending with same letter core/suffix starts with
    const next = core || suffix;
    if (prefix.slice(-1).toLowerCase() === next.charAt(0).toLowerCase()) {
      continue;
    }

    const joined = prefix + core + suffix;
    if (!isWellFormed(joined)) continue;

    const name = titleCase(joined);
    out.add(name);
  }

  return [...out];
}
