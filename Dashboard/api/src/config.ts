import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface AppConfig {
  cacheDir: string;
  activeProject: string | null;
  host: string;
  port: number;
  ollamaUrl: string;
  ollamaModel: string;
  cbmBinary: string;
}

function defaultCacheDir(): string {
  const override = process.env.CBM_CACHE_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }
  const home = process.env.HOME ?? os.homedir();
  return path.join(home, ".cache", "codebase-memory-mcp");
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : fallback;
}

export function loadConfig(): AppConfig {
  const active = process.env.CBM_PROJECT?.trim();
  return {
    cacheDir: defaultCacheDir(),
    activeProject: active && active.length > 0 ? active : null,
    host: process.env.CBM_API_HOST?.trim() || "127.0.0.1",
    port: parsePort(process.env.CBM_API_PORT, 3000),
    ollamaUrl: process.env.CBM_OLLAMA_URL?.trim() || "http://localhost:11434",
    ollamaModel: process.env.CBM_OLLAMA_MODEL?.trim() || "",
    cbmBinary: process.env.CBM_BINARY?.trim() || "codebase-memory-mcp",
  };
}

export function projectDbPath(cacheDir: string, projectName: string): string {
  return path.join(cacheDir, `${projectName}.db`);
}

export function cacheDirExists(cacheDir: string): boolean {
  try {
    return fs.existsSync(cacheDir) && fs.statSync(cacheDir).isDirectory();
  } catch {
    return false;
  }
}
