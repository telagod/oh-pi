/**
 * oh-pi Auto Update — check for new oh-pi version on session start
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24h
const STAMP_FILE = join(homedir(), ".pi", "agent", ".update-check");

function readStamp(): number {
  try { return Number(readFileSync(STAMP_FILE, "utf8").trim()) || 0; } catch { return 0; }
}

function writeStamp() {
  try { writeFileSync(STAMP_FILE, String(Date.now())); } catch {}
}

function getLatestVersion(): string | null {
  try {
    return execSync("npm view oh-pi version", { encoding: "utf8", timeout: 8000 }).trim();
  } catch { return null; }
}

function getCurrentVersion(): string | null {
  // Read from the installed package.json
  try {
    const pkgPath = join(__dirname, "..", "..", "package.json");
    if (existsSync(pkgPath)) {
      return JSON.parse(readFileSync(pkgPath, "utf8")).version;
    }
  } catch {}
  // Fallback: npm list
  try {
    const out = JSON.parse(execSync("npm list -g oh-pi --json --depth=0", { encoding: "utf8", timeout: 8000 }));
    return out.dependencies?.["oh-pi"]?.version ?? null;
  } catch { return null; }
}

export function isNewer(latest: string, current: string): boolean {
  const a = latest.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // Non-blocking: run check in background
    setTimeout(async () => {
      try {
        if (Date.now() - readStamp() < CHECK_INTERVAL) return;
        writeStamp();

        const current = getCurrentVersion();
        const latest = getLatestVersion();
        if (!current || !latest || !isNewer(latest, current)) return;

        const msg = `oh-pi ${latest} available (current: ${current}). Run: npx oh-pi@latest`;
        if (ctx.hasUI) {
          ctx.ui.toast?.(msg) ?? console.log(`\n💡 ${msg}\n`);
        }
      } catch {}
    }, 2000);
  });
}
