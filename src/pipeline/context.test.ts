import { describe, expect, it } from "vitest";
import { generateCandidates } from "./phonetics";
import { scoreBrand, totalScore } from "./scoring";
import { normalizeContext } from "./context";

describe("naming context", () => {
  it("normalizes lists from comma strings", () => {
    const ctx = normalizeContext({
      oneLiner: "AI planning for engineering teams",
      tone: "technical",
      mustFeel: "precise, calm",
      mustAvoid: "playful, crypto",
      roots: "plan, syn, nex",
    });
    expect(ctx.tone).toBe("technical");
    expect(ctx.mustFeel).toEqual(["precise", "calm"]);
    expect(ctx.roots).toContain("plan");
  });

  it("biases generation toward provided roots", () => {
    const ctx = normalizeContext({
      tone: "technical",
      roots: "nex,syn",
    });
    const names = generateCandidates(3_000, 99, ctx);
    const hit = names.some((n) => /nex|syn/i.test(n));
    expect(hit).toBe(true);
  });

  it("penalizes must-avoid collisions in scoring", () => {
    const ctx = normalizeContext({
      mustAvoid: "meta",
      tone: "enterprise",
    });
    const clean = totalScore(scoreBrand("Norvia", ctx), ctx);
    const dirty = totalScore(scoreBrand("Metavia", ctx), ctx);
    expect(clean).toBeGreaterThan(dirty);
  });
});
