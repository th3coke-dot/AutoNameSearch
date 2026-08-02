#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runPipeline } from "../pipeline/orchestrator";
import type { PipelineConfig } from "../pipeline/types";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function statusIcon(ok: boolean, unchecked?: boolean): string {
  if (unchecked) return "—";
  return ok ? "✅" : "⚠️";
}

async function main() {
  const candidates = Number(arg("--candidates") ?? "50000");
  const topN = Number(arg("--top") ?? "50");
  const seed = arg("--seed") ? Number(arg("--seed")) : undefined;
  const externalLimit = Number(arg("--external-limit") ?? "2000");
  const skipExternal = has("--skip-external");

  const config: Partial<PipelineConfig> = {
    candidateCount: candidates,
    topN,
    seed,
    externalLimit,
    skipExternal,
  };

  console.log("\nAutoNameSearch — venture naming pipeline\n");
  console.log(
    JSON.stringify(
      {
        candidates,
        topN,
        seed: seed ?? "time-based",
        externalLimit,
        skipExternal,
      },
      null,
      2,
    ),
  );
  console.log("");

  const result = await runPipeline(config, (e) => {
    const pct =
      e.done != null && e.total ? ` (${e.done}/${e.total})` : "";
    process.stdout.write(`\r[${e.stage}] ${e.message}${pct}`.padEnd(80));
    if (e.stage === "done" || (e.done != null && e.done === e.total)) {
      process.stdout.write("\n");
    }
  });

  console.log("\n── Funnel ──────────────────────────────────");
  for (const s of result.stages) {
    console.log(
      `${s.name.padEnd(12)} ${String(s.input).padStart(7)} → ${String(s.output).padStart(7)}  (−${s.rejected})  ${s.durationMs}ms`,
    );
  }

  console.log("\n── Shortlist ───────────────────────────────");
  console.log(
    "Rank  Name        Domain  TM   Ent  Brand  Total",
  );
  result.shortlist.slice(0, 25).forEach((row, i) => {
    const domainUnchecked = row.domains.every((d) => d.status === "unchecked");
    const tmUnchecked = row.trademarks.status === "unchecked";
    const brand = Math.round(
      (row.scores.memorability +
        row.scores.investorAppeal +
        row.scores.logoPotential +
        row.scores.scandinavianDna) /
        4,
    );
    console.log(
      `${String(i + 1).padStart(4)}  ${row.name.padEnd(11)} ${statusIcon(row.domainOk, domainUnchecked).padEnd(6)} ${statusIcon(row.trademarkOk, tmUnchecked).padEnd(4)} ${String(row.scores.enterpriseFeel).padStart(3)}  ${String(brand).padStart(5)}  ${String(row.total).padStart(5)}`,
    );
  });

  const outDir = path.join(process.cwd(), "data", "runs");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${result.runId}.json`);
  await writeFile(outPath, JSON.stringify(result, null, 2), "utf8");
  // Also write latest for the UI
  await writeFile(
    path.join(outDir, "latest.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );

  console.log(`\nSaved ${outPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
