import { describe, expect, it } from "vitest";
import { parseFreeTextNames, vetNames } from "./vet";

describe("parseFreeTextNames", () => {
  it("parses a single free-text name", () => {
    expect(parseFreeTextNames("  norvia  ")).toEqual(["Norvia"]);
  });

  it("parses lists and strips noise", () => {
    expect(parseFreeTextNames("Norvia, velion; Torix\nLyniq")).toEqual([
      "Norvia",
      "Velion",
      "Torix",
      "Lyniq",
    ]);
  });

  it("collapses spaced brand text into one token", () => {
    expect(parseFreeTextNames("Partner Forge")).toEqual(["Partnerforge"]);
  });
});

describe("vetNames", () => {
  it("returns a scored vetting report in skipExternal mode", async () => {
    const result = await vetNames("Norvia", {
      skipExternal: true,
      context: { tone: "nordic", oneLiner: "engineering SaaS" },
    });
    expect(result.names).toEqual(["Norvia"]);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.name).toBe("Norvia");
    expect(result.results[0]!.total).toBeGreaterThan(50);
    expect(["strong", "caution", "reject"]).toContain(result.results[0]!.verdict);
  });
});
