import { mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PipelineResult } from "./types";

/** In-memory latest (per serverless instance). Disk is best-effort. */
let memoryLatest: PipelineResult | null = null;

function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FUNCTION_NAME,
  );
}

export function runsDir(): string {
  if (isServerless()) {
    return path.join(os.tmpdir(), "autonamesearch", "runs");
  }
  return path.join(process.cwd(), "data", "runs");
}

export async function saveRun(result: PipelineResult): Promise<void> {
  memoryLatest = result;
  try {
    const dir = runsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${result.runId}.json`),
      JSON.stringify(result, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(dir, "latest.json"),
      JSON.stringify(result, null, 2),
      "utf8",
    );
  } catch {
    // Vercel/Lambda FS may still fail — response body is the source of truth.
  }
}

export async function loadLatestRun(): Promise<PipelineResult | null> {
  if (memoryLatest) return memoryLatest;
  try {
    const raw = await readFile(path.join(runsDir(), "latest.json"), "utf8");
    const parsed = JSON.parse(raw) as PipelineResult;
    memoryLatest = parsed;
    return parsed;
  } catch {
    return null;
  }
}
