import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface FsEntry {
  name: string;
  path: string;
}

export interface FsListResponse {
  path: string;
  parent: string | null;
  entries: FsEntry[];
}

export interface PickFolderResponse {
  path: string | null;
  cancelled: boolean;
  native: boolean;
}

function isAllowedPath(resolved: string): boolean {
  const home = path.resolve(os.homedir());
  if (resolved === home || resolved.startsWith(home + path.sep)) {
    return true;
  }
  if (process.platform === "darwin" && resolved.startsWith("/Volumes/")) {
    return true;
  }
  return false;
}

function resolveBrowsablePath(raw: string | undefined): string {
  const base = raw?.trim() ? path.resolve(raw.trim()) : path.resolve(os.homedir());
  if (!fs.existsSync(base)) {
    throw new Error("directory not found");
  }
  const stat = fs.statSync(base);
  if (!stat.isDirectory()) {
    throw new Error("not a directory");
  }
  if (!isAllowedPath(base)) {
    throw new Error("path not allowed");
  }
  return base;
}

export function getHomePath(): string {
  return path.resolve(os.homedir());
}

export function listDirectory(rawPath?: string): FsListResponse {
  const current = resolveBrowsablePath(rawPath);
  const parentDir = path.dirname(current);
  const parent = parentDir !== current && isAllowedPath(parentDir) ? parentDir : null;

  let names: string[] = [];
  try {
    names = fs.readdirSync(current);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "failed to read directory");
  }

  const entries: FsEntry[] = [];
  for (const name of names) {
    if (name === "." || name === "..") continue;
    const full = path.join(current, name);
    try {
      if (!fs.statSync(full).isDirectory()) continue;
      if (!isAllowedPath(full)) continue;
      entries.push({ name, path: full });
    } catch {
      // skip unreadable entries
    }
  }

  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return { path: current, parent, entries };
}

function isUserCancelled(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 1;
}

async function pickNativeFolder(): Promise<string | null> {
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        'POSIX path of (choose folder with prompt "Select repository to index")',
      ]);
      const picked = stdout.trim();
      return picked || null;
    } catch (err: unknown) {
      if (isUserCancelled(err)) return null;
      throw err;
    }
  }

  if (process.platform === "linux") {
    try {
      const { stdout } = await execFileAsync("zenity", [
        "--file-selection",
        "--directory",
        "--title=Select repository to index",
      ]);
      return stdout.trim() || null;
    } catch (err: unknown) {
      if (isUserCancelled(err)) return null;
      throw new Error("Native folder picker unavailable (install zenity or use Browse)");
    }
  }

  if (process.platform === "win32") {
    const script =
      "Add-Type -AssemblyName System.Windows.Forms; " +
      "$d = New-Object System.Windows.Forms.FolderBrowserDialog; " +
      "$d.Description = 'Select repository to index'; " +
      "if ($d.ShowDialog() -eq 'OK') { Write-Output $d.SelectedPath }";
    try {
      const { stdout } = await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-Command",
        script,
      ]);
      return stdout.trim() || null;
    } catch (err: unknown) {
      if (isUserCancelled(err)) return null;
      throw err;
    }
  }

  return null;
}

export async function pickFolder(): Promise<PickFolderResponse> {
  const picked = await pickNativeFolder();
  if (!picked) {
    return { path: null, cancelled: true, native: true };
  }

  const resolved = path.resolve(picked);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error("selected path is not a directory");
  }
  if (!isAllowedPath(resolved)) {
    throw new Error("selected path is not allowed");
  }

  return { path: resolved, cancelled: false, native: true };
}
