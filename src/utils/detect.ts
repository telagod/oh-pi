import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface EnvInfo {
  piInstalled: boolean;
  piVersion: string | null;
  hasExistingConfig: boolean;
  agentDir: string;
  terminal: string;
  os: string;
  existingFiles: string[];
  configSizeKB: number;
}

function scanDir(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) files.push(...scanDir(join(dir, e.name), rel));
      else files.push(rel);
    }
  } catch { /* skip */ }
  return files;
}

function dirSizeKB(dir: string): number {
  if (!existsSync(dir)) return 0;
  let bytes = 0;
  try {
    for (const f of scanDir(dir)) {
      try { bytes += statSync(join(dir, f)).size; } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return Math.round(bytes / 1024);
}

export async function detectEnv(): Promise<EnvInfo> {
  const agentDir = join(homedir(), ".pi", "agent");
  let piVersion: string | null = null;
  let piInstalled = false;

  try {
    piVersion = execSync("pi --version", { encoding: "utf8", timeout: 5000 }).trim();
    piInstalled = true;
  } catch { /* not installed */ }

  const existingFiles = scanDir(agentDir);

  return {
    piInstalled,
    piVersion,
    hasExistingConfig: existsSync(join(agentDir, "settings.json")),
    agentDir,
    terminal: process.env.TERM_PROGRAM ?? process.env.TERM ?? "unknown",
    os: process.platform,
    existingFiles,
    configSizeKB: dirSizeKB(agentDir),
  };
}
