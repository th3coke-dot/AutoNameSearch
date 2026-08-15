import { z } from "zod";

export const TONES = [
  "nordic",
  "enterprise",
  "industrial",
  "soft",
  "technical",
] as const;

export type NamingTone = (typeof TONES)[number];

export interface NamingContext {
  /** What the company does — one short line */
  oneLiner: string;
  /** Brand tone bias */
  tone: NamingTone;
  /** Qualities the name should evoke */
  mustFeel: string[];
  /** Qualities / associations to avoid */
  mustAvoid: string[];
  /** Optional syllable / metaphor roots to lean toward */
  roots: string[];
}

export const EMPTY_CONTEXT: NamingContext = {
  oneLiner: "",
  tone: "nordic",
  mustFeel: [],
  mustAvoid: [],
  roots: [],
};

export const NamingContextSchema = z.object({
  oneLiner: z.string().max(240).optional().default(""),
  tone: z.enum(TONES).optional().default("nordic"),
  mustFeel: z.union([z.string(), z.array(z.string())]).optional().default([]),
  mustAvoid: z.union([z.string(), z.array(z.string())]).optional().default([]),
  roots: z.union([z.string(), z.array(z.string())]).optional().default([]),
});

function splitList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : value.split(/[,;\n]+/);
  return [
    ...new Set(
      raw
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length >= 2 && s.length <= 24),
    ),
  ].slice(0, 12);
}

export function normalizeContext(
  input?: Partial<{
    oneLiner: string;
    tone: NamingTone;
    mustFeel: string | string[];
    mustAvoid: string | string[];
    roots: string | string[];
  }> | null,
): NamingContext {
  if (!input) return { ...EMPTY_CONTEXT };
  const parsed = NamingContextSchema.safeParse(input);
  const data = parsed.success ? parsed.data : NamingContextSchema.parse({});
  return {
    oneLiner: (data.oneLiner ?? "").trim().slice(0, 240),
    tone: data.tone ?? "nordic",
    mustFeel: splitList(data.mustFeel),
    mustAvoid: splitList(data.mustAvoid),
    roots: splitList(data.roots).map((r) => r.replace(/[^a-z]/g, "")).filter(Boolean),
  };
}

export function contextIsActive(ctx: NamingContext): boolean {
  return Boolean(
    ctx.oneLiner ||
      ctx.mustFeel.length ||
      ctx.mustAvoid.length ||
      ctx.roots.length ||
      ctx.tone !== "nordic",
  );
}

export function contextSummary(ctx: NamingContext): string {
  const parts = [
    ctx.oneLiner && `Company: ${ctx.oneLiner}`,
    `Tone: ${ctx.tone}`,
    ctx.mustFeel.length && `Must feel: ${ctx.mustFeel.join(", ")}`,
    ctx.mustAvoid.length && `Avoid: ${ctx.mustAvoid.join(", ")}`,
    ctx.roots.length && `Roots: ${ctx.roots.join(", ")}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Tokens from one-liner useful as soft phonetic bias */
export function derivedRootHints(ctx: NamingContext): string[] {
  if (!ctx.oneLiner) return [];
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "your",
    "our",
    "a",
    "an",
    "to",
    "of",
    "in",
    "on",
    "ai",
    "saas",
    "software",
    "platform",
    "company",
    "product",
  ]);
  return ctx.oneLiner
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && w.length <= 8 && !stop.has(w))
    .slice(0, 6);
}

export type WeightedToken = { value: string; weight: number };

/**
 * Tone + root aware reweighting of phonetic building blocks.
 * Returns new arrays — originals are never mutated.
 */
export function biasPhoneticWeights(
  prefixes: WeightedToken[],
  cores: WeightedToken[],
  suffixes: WeightedToken[],
  ctx: NamingContext,
): { prefixes: WeightedToken[]; cores: WeightedToken[]; suffixes: WeightedToken[] } {
  const p = prefixes.map((x) => ({ ...x }));
  const c = cores.map((x) => ({ ...x }));
  const s = suffixes.map((x) => ({ ...x }));

  const bump = (list: WeightedToken[], match: (v: string) => boolean, factor: number) => {
    for (const item of list) {
      if (match(item.value.toLowerCase())) item.weight = Math.max(1, item.weight * factor);
    }
  };

  switch (ctx.tone) {
    case "nordic":
      bump(p, (v) => /^(nor|nord|norv|vel|tor|fj|sk|ny|lin|lyn)/.test(v), 1.55);
      bump(s, (v) => /^(ia|on|is|io|el)$/.test(v), 1.25);
      break;
    case "enterprise":
      bump(s, (v) => /^(on|io|ix|is|or|ium|um)$/.test(v), 1.6);
      bump(c, (v) => /^(via|cor|tor|nex|syn)$/.test(v), 1.35);
      break;
    case "industrial":
      bump(p, (v) => /^(tor|kor|bor|ax|hex|vor|kar)$/.test(v), 1.65);
      bump(c, (v) => /^(tor|cor|xo|xa|dra)$/.test(v), 1.4);
      bump(s, (v) => /^(or|ix|os|us)$/.test(v), 1.35);
      break;
    case "soft":
      bump(p, (v) => /^(lin|lyn|vel|el|mer|ar|or)$/.test(v), 1.55);
      bump(c, (v) => /^(vi|ve|li|lo|na|via|lum)$/.test(v), 1.4);
      bump(s, (v) => /^(ia|a|el|en|is)$/.test(v), 1.45);
      break;
    case "technical":
      bump(p, (v) => /^(ax|hex|ny|kor|syn|om)$/.test(v), 1.5);
      bump(c, (v) => /^(nex|syn|xis|xo|xa|ony|kai)$/.test(v), 1.55);
      bump(s, (v) => /^(ix|iq|yx|io|um)$/.test(v), 1.5);
      break;
  }

  // Explicit roots — inject or boost
  const rootHints = [...ctx.roots, ...derivedRootHints(ctx)];
  for (const root of rootHints) {
    const hitP = p.find((x) => x.value.toLowerCase() === root || root.startsWith(x.value.toLowerCase()));
    const hitC = c.find((x) => x.value.toLowerCase() === root || root.includes(x.value.toLowerCase()));
    if (hitP) hitP.weight *= 2.2;
    else if (root.length >= 2 && root.length <= 5 && /^[a-z]+$/.test(root)) {
      p.push({ value: root.charAt(0).toUpperCase() + root.slice(1), weight: 14 });
    }
    if (hitC) hitC.weight *= 2.0;
    else if (root.length >= 2 && root.length <= 4 && /^[a-z]+$/.test(root)) {
      c.push({ value: root.toLowerCase(), weight: 12 });
    }
  }

  return { prefixes: p, cores: c, suffixes: s };
}

/** Extra score deltas from context fit (applied after base brand scoring). */
export function contextScoreAdjustments(
  name: string,
  ctx: NamingContext,
): Partial<Record<keyof import("./types").BrandScores, number>> {
  if (!contextIsActive(ctx) && !ctx.oneLiner) {
    // still apply tone lightly even as default nordic — no-op
  }

  const lower = name.toLowerCase();
  const adj: Partial<Record<keyof import("./types").BrandScores, number>> = {};

  // Roots / must-feel presence
  let feelHits = 0;
  for (const feel of ctx.mustFeel) {
    if (lower.includes(feel.slice(0, Math.min(4, feel.length)))) feelHits += 1;
  }
  for (const root of ctx.roots) {
    if (lower.includes(root)) feelHits += 1.5;
  }
  if (feelHits > 0) {
    adj.memorability = (adj.memorability ?? 0) + Math.min(2.2, feelHits * 0.8);
    adj.ecosystemFit = (adj.ecosystemFit ?? 0) + Math.min(2, feelHits * 0.7);
    adj.investorAppeal = (adj.investorAppeal ?? 0) + Math.min(1.5, feelHits * 0.5);
  }

  // Must-avoid penalties
  for (const avoid of ctx.mustAvoid) {
    if (lower.includes(avoid)) {
      adj.investorAppeal = (adj.investorAppeal ?? 0) - 4;
      adj.enterpriseFeel = (adj.enterpriseFeel ?? 0) - 3;
      adj.memorability = (adj.memorability ?? 0) - 2;
    }
  }

  // Tone alignment
  switch (ctx.tone) {
    case "nordic":
      if (/^(nor|nord|vel|tor|fj|sk|lin|lyn)/.test(lower)) {
        adj.scandinavianDna = (adj.scandinavianDna ?? 0) + 1.2;
      }
      break;
    case "enterprise":
      if (/(on|io|ix|is|or)$/.test(lower)) {
        adj.enterpriseFeel = (adj.enterpriseFeel ?? 0) + 1.3;
        adj.investorAppeal = (adj.investorAppeal ?? 0) + 0.8;
      }
      break;
    case "industrial":
      if (/[xkq]|tor|kor|bor|ax/.test(lower)) {
        adj.logoPotential = (adj.logoPotential ?? 0) + 0.8;
        adj.enterpriseFeel = (adj.enterpriseFeel ?? 0) + 0.6;
      }
      break;
    case "soft":
      if (/(ia|el|en|is)$/.test(lower) && !/[xqz]{2}/.test(lower)) {
        adj.pronunciation = (adj.pronunciation ?? 0) + 1.2;
        adj.typography = (adj.typography ?? 0) + 0.6;
      }
      break;
    case "technical":
      if (/x|q|nex|syn|ix|iq|yx/.test(lower)) {
        adj.verbPotential = (adj.verbPotential ?? 0) + 1;
        adj.ecosystemFit = (adj.ecosystemFit ?? 0) + 0.8;
      }
      break;
  }

  // One-liner keyword soft boost
  for (const hint of derivedRootHints(ctx)) {
    if (lower.includes(hint.slice(0, Math.min(4, hint.length)))) {
      adj.ecosystemFit = (adj.ecosystemFit ?? 0) + 0.4;
    }
  }

  return adj;
}

/** Weight multipliers for totalScore when a tone is selected */
export function toneScoreWeights(tone: NamingTone): Record<string, number> {
  switch (tone) {
    case "nordic":
      return { scandinavianDna: 1.45, enterpriseFeel: 1.35, investorAppeal: 1.35 };
    case "enterprise":
      return { enterpriseFeel: 1.55, investorAppeal: 1.5, memorability: 1.25 };
    case "industrial":
      return { logoPotential: 1.35, enterpriseFeel: 1.35, typography: 1.15 };
    case "soft":
      return { pronunciation: 1.45, typography: 1.25, memorability: 1.35 };
    case "technical":
      return { verbPotential: 1.3, ecosystemFit: 1.4, memorability: 1.25 };
  }
}
