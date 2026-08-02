import { NextResponse } from "next/server";
import { loadLatestRun } from "@/pipeline/storage";

export const runtime = "nodejs";

export async function GET() {
  const latest = await loadLatestRun();
  if (!latest) {
    return NextResponse.json(
      { error: "No run yet. Start a pipeline from the UI or CLI." },
      { status: 404 },
    );
  }
  return NextResponse.json(latest);
}
