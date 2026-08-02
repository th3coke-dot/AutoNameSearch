import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const file = path.join(process.cwd(), "data", "runs", "latest.json");
    const raw = await readFile(file, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: "No run yet. Start a pipeline from the UI or CLI." },
      { status: 404 },
    );
  }
}
