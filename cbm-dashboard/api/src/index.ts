import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "./config.js";

export type IndexJobStatus = "idle" | "running" | "done" | "error";

export interface IndexJob {
  slot: number;
  status: IndexJobStatus;
  rootPath: string;
  projectName: string;
  mode: string;
  error: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface StartIndexRequest {
  rootPath: string;
  projectName?: string;
  mode?: string;
}

export interface StartIndexResponse {
  status: "indexing";
  slot: number;
  path: string;
}

const MAX_JOBS = 4;
const VALID_MODES = new Set(["full", "fast", "moderate"]);

interface InternalJob extends IndexJob {
  child: ReturnType<typeof spawn> | null;
}

const jobs: InternalJob[] = Array.from({ length: MAX_JOBS }, (_, slot) => ({
  slot,
  status: "idle" as IndexJobStatus,
  rootPath: "",
  projectName: "",
  mode: "full",
  error: "",
  startedAt: null,
  finishedAt: null,
  child: null,
}));

function publicJob(job: InternalJob): IndexJob {
  return {
    slot: job.slot,
    status: job.status,
    rootPath: job.rootPath,
    projectName: job.projectName,
    mode: job.mode,
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

function findFreeSlot(): number {
  for (const job of jobs) {
    if (job.status === "idle" || job.status === "done" || job.status === "error") {
      return job.slot;
    }
  }
  return -1;
}

function resolveMode(mode?: string): string {
  const m = mode?.trim().toLowerCase() || "full";
  return VALID_MODES.has(m) ? m : "full";
}

export function listIndexJobs(): IndexJob[] {
  return jobs.filter((j) => j.status !== "idle").map(publicJob);
}

export function startIndex(
  config: AppConfig,
  req: StartIndexRequest,
): StartIndexResponse {
  const rootPath = req.rootPath?.trim();
  if (!rootPath) {
    throw new Error("rootPath is required");
  }

  const resolved = path.resolve(rootPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error("directory not found");
  }

  const slot = findFreeSlot();
  if (slot < 0) {
    throw new Error("all index slots busy");
  }

  const job = jobs[slot]!;
  job.status = "running";
  job.rootPath = resolved;
  job.projectName = req.projectName?.trim() ?? "";
  job.mode = resolveMode(req.mode);
  job.error = "";
  job.startedAt = new Date().toISOString();
  job.finishedAt = null;

  const args: Record<string, string> = {
    repo_path: resolved,
    mode: job.mode,
  };
  if (job.projectName) {
    args.name = job.projectName;
  }

  const jsonArg = JSON.stringify(args);
  const child = spawn(config.cbmBinary, ["cli", "index_repository", jsonArg], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  job.child = child;

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
    if (stderr.length > 4000) {
      stderr = stderr.slice(-4000);
    }
  });

  child.on("error", (err) => {
    job.status = "error";
    job.error = err.message;
    job.finishedAt = new Date().toISOString();
    job.child = null;
  });

  child.on("close", (code) => {
    job.child = null;
    job.finishedAt = new Date().toISOString();
    if (code === 0) {
      job.status = "done";
      job.error = "";
    } else {
      job.status = "error";
      job.error =
        stderr.trim() ||
        `indexing failed (exit code ${code ?? "unknown"})`;
    }
  });

  return { status: "indexing", slot, path: resolved };
}
