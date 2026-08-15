import { NextResponse } from "next/server";
import { z } from "zod";
import { NamingContextSchema, normalizeContext } from "@/pipeline/context";
import { vetNames } from "@/pipeline/vet";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  query: z.string().min(1).max(500),
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

    const result = await vetNames(parsed.data.query, {
      skipExternal: parsed.data.skipExternal ?? false,
      context: normalizeContext(parsed.data.context),
    });

    if (!result.names.length) {
      return NextResponse.json(
        { error: "No valid names found in that text. Try something like Norvia." },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "vet failed" },
      { status: 500 },
    );
  }
}
