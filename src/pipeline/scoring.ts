import type { BrandScores, ScoredName } from "./types";
import { PREFIXES, CORES, SUFFIXES } from "./phonetics";

const SCANDI_PREFIX = new Set(
  ["nor", "norv", "nord", "bor", "val", "ver", "vor", "lin", "lyn", "vel", "tre", "tor", "fj", "sk", "ny"].map(
    (s) => s.toLowerCase(),
  ),
);

const ENTERPRISE_SUFFIX = new Set(
  ["is", "ix", "io", "or", "on", "ia", "os", "us", "ium", "iq", "um"].map((s) => s.toLowerCase()),
);

const VERBABLE = [/ize$/i, /fy$/i, /ate$/i, /io$/i, /on$/i, /ix$/i];

function clamp(n: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
}

function hasPrefix(name: string, list: Set<string>): boolean {
  const lower = name.toLowerCase();
  for (const p of list) {
    if (lower.startsWith(p)) return true;
  }
  return false;
}

function hasSuffix(name: string, list: Set<string>): boolean {
  const lower = name.toLowerCase();
  for (const s of list) {
    if (lower.endsWith(s)) return true;
  }
  return false;
}

function syllableEstimate(name: string): number {
  const lower = name.toLowerCase().replace(/e$/i, "");
  const groups = lower.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

/**
 * Deterministic brand scoring — no LLM required for v1.
 * Tuned for Scandinavian-engineering SaaS / enterprise feel.
 * Deterministic in-process scorer; trademark AI search is a separate stage.
 */
export function scoreBrand(name: string): BrandScores {
  const lower = name.toLowerCase();
  const len = lower.length;
  const syllables = syllableEstimate(lower);

  // Enterprise feel: short, clean suffix, no novelty spam
  let enterprise = 6;
  if (len >= 5 && len <= 7) enterprise += 2;
  if (len === 8) enterprise += 1;
  if (hasSuffix(lower, ENTERPRISE_SUFFIX)) enterprise += 1.5;
  if (/x|q|z/.test(lower)) enterprise += 0.5;
  if (/[0-9]/.test(lower) || /ly$|ify$|r$/i.test(lower)) enterprise -= 1;

  // Scandinavian DNA
  let scandi = 4;
  if (hasPrefix(lower, SCANDI_PREFIX)) scandi += 4;
  if (/nor|nord|vor|vel|tor|fj|sk/.test(lower)) scandi += 1.5;
  if (/via|ion|vik|lund/.test(lower)) scandi += 1;

  // Typography — letter shapes, balance, no awkward tails
  let typography = 6;
  if (!/(.)\1/.test(lower)) typography += 1;
  if (/[iljtf]/.test(lower)) typography += 0.5; // good wordmark stems
  if (/[mw]{2}/.test(lower)) typography -= 1.5;
  if (len <= 6) typography += 1;
  // Capital letter + clean lowercase rest assumed
  typography += 0.5;

  // Pronunciation
  let pronunciation = 7;
  if (syllables <= 3) pronunciation += 1.5;
  if (syllables === 2) pronunciation += 0.5;
  if (/[bcdfghjklmnpqrstvwxz]{3}/.test(lower)) pronunciation -= 3;
  if (/^[aeiou]/i.test(lower)) pronunciation -= 0.5;
  // Familiar CVCV patterns
  if (/^([bcdfghjklmnpqrstvwxz]+[aeiou]+){2,}$/i.test(lower)) pronunciation += 1;

  // Memorability
  let memorability = 6;
  if (len >= 5 && len <= 7) memorability += 2;
  if (syllables === 2 || syllables === 3) memorability += 1;
  if (/x|q|z|v/.test(lower)) memorability += 0.8;
  // Distinctiveness vs common English
  if (!/^(the|app|data|cloud|soft|tech|smart)/i.test(lower)) memorability += 0.5;

  // Investor appeal
  let investor = 6;
  if (enterprise >= 8) investor += 1.5;
  if (scandi >= 7) investor += 1;
  if (len <= 7 && /on$|io$|ix$|is$|ia$/i.test(lower)) investor += 1.5;
  if (/crypto|coin|nft|meta|gpt/i.test(lower)) investor -= 4;

  // Logo potential — geometric letters, short, balanced
  let logo = 6;
  if (len <= 7) logo += 1.5;
  if (/^[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/i.test(name)) logo += 0.5;
  if (/o|a|v|x|n|o/.test(lower)) logo += 1; // shapes
  if (/(.)\1/.test(lower)) logo -= 0.5;

  // Verb potential — "let's X it" / productize
  let verb = 4;
  if (VERBABLE.some((re) => re.test(lower))) verb += 2;
  if (/io$|on$|ix$|fy$/i.test(lower)) verb += 2;
  if (syllables <= 2) verb += 1;

  // Ecosystem fit with Scope2Plan / PartnerForge style (compound-capable, product-family)
  let ecosystem = 6;
  if (/via|ion|forge|scope|plan|partner|core|tor|nex|syn/.test(lower)) ecosystem += 1.5;
  if (len <= 8) ecosystem += 1;
  if (hasSuffix(lower, ENTERPRISE_SUFFIX)) ecosystem += 1;
  // Works as root for product lines: Name Cloud, Name AI, Name OS
  if (syllables <= 3 && len <= 8) ecosystem += 1;

  // Tiny boost if assembled from our designed blocks
  const fromBlocks =
    PREFIXES.some((p) => lower.startsWith(p.value.toLowerCase())) &&
    SUFFIXES.some((s) => lower.endsWith(s.value.toLowerCase()));
  if (fromBlocks) {
    enterprise += 0.3;
    scandi += 0.3;
    investor += 0.3;
  }
  void CORES;

  return {
    enterpriseFeel: clamp(enterprise),
    scandinavianDna: clamp(scandi),
    typography: clamp(typography),
    pronunciation: clamp(pronunciation),
    memorability: clamp(memorability),
    investorAppeal: clamp(investor),
    logoPotential: clamp(logo),
    verbPotential: clamp(verb),
    ecosystemFit: clamp(ecosystem),
  };
}

export function totalScore(scores: BrandScores): number {
  // Weighted toward enterprise + investor + scandi + memorability
  const weighted =
    scores.enterpriseFeel * 1.4 +
    scores.scandinavianDna * 1.2 +
    scores.typography * 0.9 +
    scores.pronunciation * 1.1 +
    scores.memorability * 1.3 +
    scores.investorAppeal * 1.4 +
    scores.logoPotential * 1.0 +
    scores.verbPotential * 0.7 +
    scores.ecosystemFit * 1.0;

  const max =
    10 *
    (1.4 + 1.2 + 0.9 + 1.1 + 1.3 + 1.4 + 1.0 + 0.7 + 1.0);
  return Math.round((weighted / max) * 100);
}

export function rankNames(names: ScoredName[]): ScoredName[] {
  return [...names].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.scores.investorAppeal !== a.scores.investorAppeal) {
      return b.scores.investorAppeal - a.scores.investorAppeal;
    }
    return a.name.localeCompare(b.name);
  });
}
