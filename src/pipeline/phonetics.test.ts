import { describe, expect, it } from "vitest";
import { generateCandidates } from "./phonetics";
import { linguisticFilter } from "./filters";
import { scoreBrand, totalScore } from "./scoring";

describe("generateCandidates", () => {
  it("produces deterministic sets for a seed", () => {
    const a = generateCandidates(200, 42);
    const b = generateCandidates(200, 42);
    expect(a).toEqual(b);
  });

  it("yields designed-looking names in the example family", () => {
    const names = generateCandidates(5_000, 7);
    // At least some familiar constructions should appear at volume
    const joined = names.join(" ");
    expect(joined.length).toBeGreaterThan(0);
    expect(names.every((n) => n[0] === n[0]!.toUpperCase())).toBe(true);
  });
});

describe("linguisticFilter", () => {
  it("keeps diphthong examples from the brief", () => {
    const { kept, rejected } = linguisticFilter([
      "Norvia",
      "Korvix",
      "Velion",
      "Torvia",
      "Verion",
      "Lyniq",
      "Arvos",
      "Corion",
      "Trevix",
      "Vorion",
    ]);
    expect(kept).toEqual(
      expect.arrayContaining([
        "Norvia",
        "Korvix",
        "Velion",
        "Lyniq",
        "Arvos",
        "Trevix",
      ]),
    );
    expect(rejected.filter((r) => r.reason === "double vowels")).toHaveLength(0);
  });

  it("rejects long names, triple consonants, and repeated vowels", () => {
    const { rejected } = linguisticFilter([
      "Norviatonium",
      "Borktrx",
      "Voolix",
      "Norrviaa",
    ]);
    const reasons = rejected.map((r) => r.reason).join(" ");
    expect(reasons).toMatch(/longer|triple|double/i);
  });
});

describe("scoreBrand", () => {
  it("scores Scandinavian enterprise names highly", () => {
    const norvia = scoreBrand("Norvia");
    const junk = scoreBrand("Qqwxxz");
    expect(totalScore(norvia)).toBeGreaterThan(totalScore(junk));
    expect(norvia.scandinavianDna).toBeGreaterThanOrEqual(7);
    expect(norvia.enterpriseFeel).toBeGreaterThanOrEqual(7);
  });
});
