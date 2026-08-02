import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runPipeline } from "@/pipeline/orchestrator";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  candidateCount: z.number().int().min(100).max(100_000).optional(),
  topN: z.number().int().min(5).max(200).optional(),
  seed: z.number().int().optional(),
  externalLimit: z.number().int().min(10).max(10_000).optional(),
  skipExternal: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await runPipeline({
      candidateCount: parsed.data.candidateCount ?? 2_000,
      topN: parsed.data.topN ?? 50,
      seed: parsed.data.seed,
      externalLimit: parsed.data.externalLimit ?? 500,
      skipExternal: parsed.data.skipExternal ?? true,
    });

    const outDir = path.join(process.cwd(), "data", "runs");
    await mkdir(outDir, { recursive: true });
    await writeFile(
      path.join(outDir, `${result.runId}.json`),
      JSON.stringify(result, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(outDir, "latest.json"),
      JSON.stringify(result, null, 2),
      "utf8",
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "pipeline failed" },
      { status: 500 },
    );
  }
}
