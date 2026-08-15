import type { BrandScores, ScoredName } from "./types";
import { PREFIXES, CORES, SUFFIXES } from "./phonetics";
import {
  contextScoreAdjustments,
  toneScoreWeights,
  type NamingContext,
  EMPTY_CONTEXT,
} from "./context";

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
 * Deterministic brand scoring with optional brief context.
 */
export function scoreBrand(
  name: string,
  context: NamingContext = EMPTY_CONTEXT,
): BrandScores {
  const lower = name.toLowerCase();
  const len = lower.length;
  const syllables = syllableEstimate(lower);

  let enterprise = 6;
  if (len >= 5 && len <= 7) enterprise += 2;
  if (len === 8) enterprise += 1;
  if (hasSuffix(lower, ENTERPRISE_SUFFIX)) enterprise += 1.5;
  if (/x|q|z/.test(lower)) enterprise += 0.5;
  if (/[0-9]/.test(lower) || /ly$|ify$|r$/i.test(lower)) enterprise -= 1;

  let scandi = 4;
  if (hasPrefix(lower, SCANDI_PREFIX)) scandi += 4;
  if (/nor|nord|vor|vel|tor|fj|sk/.test(lower)) scandi += 1.5;
  if (/via|ion|vik|lund/.test(lower)) scandi += 1;

  let typography = 6;
  if (!/(.)\1/.test(lower)) typography += 1;
  if (/[iljtf]/.test(lower)) typography += 0.5;
  if (/[mw]{2}/.test(lower)) typography -= 1.5;
  if (len <= 6) typography += 1;
  typography += 0.5;

  let pronunciation = 7;
  if (syllables <= 3) pronunciation += 1.5;
  if (syllables === 2) pronunciation += 0.5;
  if (/[bcdfghjklmnpqrstvwxz]{3}/.test(lower)) pronunciation -= 3;
  if (/^[aeiou]/i.test(lower)) pronunciation -= 0.5;
  if (/^([bcdfghjklmnpqrstvwxz]+[aeiou]+){2,}$/i.test(lower)) pronunciation += 1;

  let memorability = 6;
  if (len >= 5 && len <= 7) memorability += 2;
  if (syllables === 2 || syllables === 3) memorability += 1;
  if (/x|q|z|v/.test(lower)) memorability += 0.8;
  if (!/^(the|app|data|cloud|soft|tech|smart)/i.test(lower)) memorability += 0.5;

  let investor = 6;
  if (enterprise >= 8) investor += 1.5;
  if (scandi >= 7) investor += 1;
  if (len <= 7 && /on$|io$|ix$|is$|ia$/i.test(lower)) investor += 1.5;
  if (/crypto|coin|nft|meta|gpt/i.test(lower)) investor -= 4;

  let logo = 6;
  if (len <= 7) logo += 1.5;
  if (/^[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/i.test(name)) logo += 0.5;
  if (/o|a|v|x|n|o/.test(lower)) logo += 1;
  if (/(.)\1/.test(lower)) logo -= 0.5;

  let verb = 4;
  if (VERBABLE.some((re) => re.test(lower))) verb += 2;
  if (/io$|on$|ix$|fy$/i.test(lower)) verb += 2;
  if (syllables <= 2) verb += 1;

  let ecosystem = 6;
  if (/via|ion|forge|scope|plan|partner|core|tor|nex|syn/.test(lower)) ecosystem += 1.5;
  if (len <= 8) ecosystem += 1;
  if (hasSuffix(lower, ENTERPRISE_SUFFIX)) ecosystem += 1;
  if (syllables <= 3 && len <= 8) ecosystem += 1;

  const fromBlocks =
    PREFIXES.some((p) => lower.startsWith(p.value.toLowerCase())) &&
    SUFFIXES.some((s) => lower.endsWith(s.value.toLowerCase()));
  if (fromBlocks) {
    enterprise += 0.3;
    scandi += 0.3;
    investor += 0.3;
  }
  void CORES;

  const adj = contextScoreAdjustments(name, context);
  enterprise += adj.enterpriseFeel ?? 0;
  scandi += adj.scandinavianDna ?? 0;
  typography += adj.typography ?? 0;
  pronunciation += adj.pronunciation ?? 0;
  memorability += adj.memorability ?? 0;
  investor += adj.investorAppeal ?? 0;
  logo += adj.logoPotential ?? 0;
  verb += adj.verbPotential ?? 0;
  ecosystem += adj.ecosystemFit ?? 0;

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

export function totalScore(
  scores: BrandScores,
  context: NamingContext = EMPTY_CONTEXT,
): number {
  const tone = toneScoreWeights(context.tone);
  const w = {
    enterpriseFeel: tone.enterpriseFeel ?? 1.4,
    scandinavianDna: tone.scandinavianDna ?? 1.2,
    typography: tone.typography ?? 0.9,
    pronunciation: tone.pronunciation ?? 1.1,
    memorability: tone.memorability ?? 1.3,
    investorAppeal: tone.investorAppeal ?? 1.4,
    logoPotential: tone.logoPotential ?? 1.0,
    verbPotential: tone.verbPotential ?? 0.7,
    ecosystemFit: tone.ecosystemFit ?? 1.0,
  };

  const weighted =
    scores.enterpriseFeel * w.enterpriseFeel +
    scores.scandinavianDna * w.scandinavianDna +
    scores.typography * w.typography +
    scores.pronunciation * w.pronunciation +
    scores.memorability * w.memorability +
    scores.investorAppeal * w.investorAppeal +
    scores.logoPotential * w.logoPotential +
    scores.verbPotential * w.verbPotential +
    scores.ecosystemFit * w.ecosystemFit;

  const max =
    10 *
    (w.enterpriseFeel +
      w.scandinavianDna +
      w.typography +
      w.pronunciation +
      w.memorability +
      w.investorAppeal +
      w.logoPotential +
      w.verbPotential +
      w.ecosystemFit);
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
