import { describe, expect, it } from "vitest";
import { screenTrademarksBatch } from "./trademarks";

describe("screenTrademarksBatch", () => {
  it("returns unchecked in skipExternal mode", async () => {
    const results = await screenTrademarksBatch(["Norvia", "Velion"], {
      skipExternal: true,
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "unchecked")).toBe(true);
  });
});
