import { writeFileSync, mkdirSync, readFileSync, copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import type { OhPConfig } from "../types.js";
import { KEYBINDING_SCHEMES, PROVIDERS } from "../types.js";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

/** Recursively copy a directory */
function copyDir(src: string, dest: string) {
  ensureDir(dest);
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export function applyConfig(config: OhPConfig) {
  const agentDir = join(homedir(), ".pi", "agent");
  ensureDir(agentDir);

  // 1. auth.json
  const auth: Record<string, { type: string; key: string }> = {};
  for (const p of config.providers) {
    auth[p.name] = { type: "api_key", key: p.apiKey };
  }
  const authPath = join(agentDir, "auth.json");
  writeFileSync(authPath, JSON.stringify(auth, null, 2), { mode: 0o600 });

  // 2. settings.json
  const primary = config.providers[0];
  const providerInfo = primary ? PROVIDERS[primary.name] : undefined;
  const settings: Record<string, unknown> = {
    defaultProvider: primary?.name,
    defaultModel: primary?.defaultModel ?? providerInfo?.models[0],
    defaultThinkingLevel: config.thinking,
    theme: config.theme,
    enableSkillCommands: true,
    compaction: { enabled: true, reserveTokens: 16384, keepRecentTokens: 20000 },
    retry: { enabled: true, maxRetries: 3 },
  };
  if (config.providers.length > 1) {
    settings.enabledModels = config.providers.flatMap((p) => {
      const info = PROVIDERS[p.name];
      return info ? info.models : [];
    });
  }
  writeFileSync(join(agentDir, "settings.json"), JSON.stringify(settings, null, 2));

  // 3. models.json (custom endpoints / providers)
  const customProviders = config.providers.filter(p => p.baseUrl);
  if (customProviders.length > 0) {
    const models: Record<string, unknown> = {};
    for (const cp of customProviders) {
      models[cp.name] = {
        baseUrl: cp.baseUrl,
        apiKey: cp.apiKey === "none" ? undefined : cp.apiKey,
        api: "openai-completions",
        models: cp.defaultModel ? [{
          id: cp.defaultModel,
          name: cp.defaultModel,
          reasoning: false,
          input: ["text"],
          contextWindow: 128000,
          maxTokens: 8192,
        }] : [],
      };
    }
    writeFileSync(join(agentDir, "models.json"), JSON.stringify(models, null, 2));
  }

  // 4. keybindings.json
  const kb = KEYBINDING_SCHEMES[config.keybindings];
  if (kb && Object.keys(kb).length > 0) {
    writeFileSync(join(agentDir, "keybindings.json"), JSON.stringify(kb, null, 2));
  }

  // 5. AGENTS.md
  const agentsSrc = join(PKG_ROOT, "pi-package", "agents", `${config.agents}.md`);
  try {
    const content = readFileSync(agentsSrc, "utf8");
    writeFileSync(join(agentDir, "AGENTS.md"), content);
  } catch { /* template not found, skip */ }

  // 6. Copy extensions (single file .ts or directory with index.ts)
  const extDir = join(agentDir, "extensions");
  ensureDir(extDir);
  for (const ext of config.extensions) {
    const dirSrc = join(PKG_ROOT, "pi-package", "extensions", ext);
    const fileSrc = join(PKG_ROOT, "pi-package", "extensions", `${ext}.ts`);
    if (existsSync(dirSrc) && statSync(dirSrc).isDirectory()) {
      copyDir(dirSrc, join(extDir, ext));
    } else {
      try { copyFileSync(fileSrc, join(extDir, `${ext}.ts`)); } catch { /* skip */ }
    }
  }

  // 7. Copy prompts
  const promptDir = join(agentDir, "prompts");
  ensureDir(promptDir);
  for (const p of config.prompts) {
    const src = join(PKG_ROOT, "pi-package", "prompts", `${p}.md`);
    try { copyFileSync(src, join(promptDir, `${p}.md`)); } catch { /* skip */ }
  }

  // 8. Copy skills
  const skillDir = join(agentDir, "skills");
  ensureDir(skillDir);
  for (const s of config.skills) {
    const srcDir = join(PKG_ROOT, "pi-package", "skills", s);
    const destDir = join(skillDir, s);
    ensureDir(destDir);
    try { copyFileSync(join(srcDir, "SKILL.md"), join(destDir, "SKILL.md")); } catch { /* skip */ }
  }

  // 9. Copy themes (only custom ones)
  const themeDir = join(agentDir, "themes");
  ensureDir(themeDir);
  const themeSrc = join(PKG_ROOT, "pi-package", "themes", `${config.theme}.json`);
  try { copyFileSync(themeSrc, join(themeDir, `${config.theme}.json`)); } catch { /* built-in theme */ }
}

export function installPi() {
  try {
    execSync("npm install -g @mariozechner/pi-coding-agent", { stdio: "inherit" });
  } catch {
    throw new Error("Failed to install pi-coding-agent");
  }
}

/** 备份 ~/.pi/agent/ 到 ~/.pi/agent.bak-{timestamp}/ */
export function backupConfig(): string {
  const agentDir = join(homedir(), ".pi", "agent");
  if (!existsSync(agentDir)) return "";
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(homedir(), ".pi", `agent.bak-${ts}`);
  copyDir(agentDir, backupDir);
  return backupDir;
}
