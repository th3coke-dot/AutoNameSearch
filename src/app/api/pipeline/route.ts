import { NextResponse } from "next/server";
import { runPipeline } from "@/pipeline/orchestrator";
import { saveRun } from "@/pipeline/storage";
import { NamingContextSchema, normalizeContext } from "@/pipeline/context";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  candidateCount: z.number().int().min(100).max(100_000).optional(),
  topN: z.number().int().min(5).max(200).optional(),
  seed: z.number().int().optional(),
  externalLimit: z.number().int().min(10).max(10_000).optional(),
  skipExternal: z.boolean().optional(),
  context: NamingContextSchema.optional(),
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
      context: normalizeContext(parsed.data.context),
    });

    await saveRun(result);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "pipeline failed" },
      { status: 500 },
    );
  }
}
