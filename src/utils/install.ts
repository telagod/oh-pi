import { writeFileSync, mkdirSync, readFileSync, copyFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import type { OhPConfig } from "../types.js";
import { KEYBINDING_SCHEMES, MODEL_CAPABILITIES, PROVIDERS } from "../types.js";
import { resources } from "./resources.js";

/**
 * 确保目录存在，若不存在则递归创建
 * @param dir - 目标目录路径
 */
function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

/**
 * 清空并重建目录，若目录已存在则先删除再重新创建
 * @param dir - 目标目录路径
 */
function cleanDir(dir: string) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  ensureDir(dir);
}

/**
 * 递归复制目录及其所有内容到目标路径
 * @param src - 源目录路径
 * @param dest - 目标目录路径
 */
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

/**
 * 应用 OhP 配置，生成并写入 ~/.pi/agent/ 下的所有配置文件
 * @param config - OhP 配置对象
 */
export function applyConfig(config: OhPConfig) {
  const agentDir = join(homedir(), ".pi", "agent");
  ensureDir(agentDir);

  // 1. auth.json (skip providers that have apiKey in models.json via baseUrl)
  const authProviders = config.providers.filter(p => !p.baseUrl && p.apiKey !== "none");
  if (authProviders.length > 0) {
    const auth: Record<string, { type: string; key: string }> = {};
    for (const p of authProviders) {
      auth[p.name] = { type: "api_key", key: p.apiKey };
    }
    const authPath = join(agentDir, "auth.json");
    writeFileSync(authPath, JSON.stringify(auth, null, 2), { mode: 0o600 });
  }

  // 2. settings.json
  // Issue #4 fix: prefer provider with baseUrl+defaultModel as primary (custom endpoint user intent)
  const primary = config.providers.find(p => p.baseUrl && p.defaultModel) ?? config.providers[0];
  const providerInfo = primary ? PROVIDERS[primary.name] : undefined;
  const compactThreshold = config.compactThreshold ?? 0.75;
  const reserveTokens = 32000;
  const primaryModel = primary?.defaultModel ?? providerInfo?.models[0];
  const settings: Record<string, unknown> = {
    ...(primary ? { defaultProvider: primary.name, defaultModel: primaryModel } : {}),
    defaultThinkingLevel: config.thinking,
    theme: config.theme,
    enableSkillCommands: true,
    compaction: { enabled: true, reserveTokens, keepRecentTokens: 20000 },
    retry: { enabled: true, maxRetries: 3 },
    quietStartup: true,
  };
  if (config.providers.length > 1) {
    settings.enabledModels = config.providers.flatMap((p) => {
      if (p.discoveredModels?.length) return p.discoveredModels.map(m => m.id);
      const info = PROVIDERS[p.name];
      return info ? info.models : [];
    });
  }
  writeFileSync(join(agentDir, "settings.json"), JSON.stringify(settings, null, 2));

  // 3. models.json (custom endpoints / providers)
  const customProviders = config.providers.filter(p => p.baseUrl);
  if (customProviders.length > 0) {
    const providers: Record<string, unknown> = {};
    for (const cp of customProviders) {
      const isBuiltin = !!PROVIDERS[cp.name];
      if (isBuiltin && !cp.discoveredModels?.length) {
        // Known provider with custom baseUrl, no discovered models — just override endpoint
        const entry: Record<string, unknown> = { baseUrl: cp.baseUrl };
        if (cp.apiKey !== "none") entry.apiKey = cp.apiKey;
        providers[cp.name] = entry;
      } else {
        // Custom provider or builtin with discovered models — write full config
        const entry: Record<string, unknown> = {
          baseUrl: cp.baseUrl,
          api: cp.api ?? "openai-completions",
        };
        if (cp.apiKey !== "none") entry.apiKey = cp.apiKey;

        if (cp.discoveredModels?.length) {
          // Write ALL discovered models with their metadata
          entry.models = cp.discoveredModels.map(m => ({
            id: m.id,
            name: m.id,
            reasoning: m.reasoning,
            input: m.input,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: m.contextWindow,
            maxTokens: m.maxTokens,
          }));
        } else if (cp.defaultModel) {
          const caps = MODEL_CAPABILITIES[cp.defaultModel];
          entry.models = [{
            id: cp.defaultModel,
            name: cp.defaultModel,
            reasoning: cp.reasoning ?? caps?.reasoning ?? false,
            input: cp.multimodal ? ["text", "image"] : (caps?.input ?? ["text"]),
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: cp.contextWindow ?? caps?.contextWindow ?? 128000,
            maxTokens: cp.maxTokens ?? caps?.maxTokens ?? 8192,
          }];
        }
        providers[cp.name] = entry;
      }
    }
    writeFileSync(join(agentDir, "models.json"), JSON.stringify({ providers }, null, 2));
  }

  // 4. keybindings.json
  const kb = KEYBINDING_SCHEMES[config.keybindings];
  if (kb && Object.keys(kb).length > 0) {
    writeFileSync(join(agentDir, "keybindings.json"), JSON.stringify(kb, null, 2));
  }

  // 5. AGENTS.md
  const agentsSrc = resources.agent(config.agents);
  try {
    let content = readFileSync(agentsSrc, "utf8");
    if (config.locale && config.locale !== "en") {
      const langNames: Record<string, string> = { zh: "Chinese (中文)", fr: "French (Français)" };
      const lang = langNames[config.locale] ?? config.locale;
      content = `## Language\nAlways respond in ${lang}. Use the user's language for all conversations and explanations. Code, commands, and technical terms can remain in English.\n\n${content}`;
    }
    writeFileSync(join(agentDir, "AGENTS.md"), content);
  } catch { /* template not found, skip */ }

  // 6. Copy extensions (single file .ts or directory with index.ts)
  const extDir = join(agentDir, "extensions");
  cleanDir(extDir);
  for (const ext of config.extensions) {
    const dirSrc = resources.extension(ext);
    const fileSrc = resources.extensionFile(ext);
    if (existsSync(dirSrc) && statSync(dirSrc).isDirectory()) {
      copyDir(dirSrc, join(extDir, ext));
    } else {
      try { copyFileSync(fileSrc, join(extDir, `${ext}.ts`)); } catch { /* skip */ }
    }
  }

  // 7. Copy prompts
  const promptDir = join(agentDir, "prompts");
  cleanDir(promptDir);
  for (const p of config.prompts) {
    const src = resources.prompt(p);
    try { copyFileSync(src, join(promptDir, `${p}.md`)); } catch { /* skip */ }
  }

  // 8. Copy skills (auto-discover all from pi-package/skills/)
  const skillDir = join(agentDir, "skills");
  cleanDir(skillDir);
  const skillsSrcDir = resources.skillsDir();
  try {
    for (const entry of readdirSync(skillsSrcDir, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(skillsSrcDir, entry.name, "SKILL.md"))) {
        copyDir(join(skillsSrcDir, entry.name), join(skillDir, entry.name));
      }
    }
  } catch { /* skills dir not found, skip */ }

  // 9. Copy themes (only custom ones)
  const themeDir = join(agentDir, "themes");
  cleanDir(themeDir);
  const themeSrc = resources.theme(config.theme);
  try { copyFileSync(themeSrc, join(themeDir, `${config.theme}.json`)); } catch { /* built-in theme */ }
}

/**
 * 全局安装 pi-coding-agent，安装失败时抛出异常
 */
export function installPi() {
  try {
    execSync("npm install -g @mariozechner/pi-coding-agent", { stdio: "inherit" });
  } catch {
    throw new Error("Failed to install pi-coding-agent");
  }
}

/**
 * 备份 ~/.pi/agent/ 目录到 ~/.pi/agent.bak-{timestamp}/
 * @returns 备份目录路径，若原目录不存在则返回空字符串
 */
export function backupConfig(): string {
  const agentDir = join(homedir(), ".pi", "agent");
  if (!existsSync(agentDir)) return "";
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(homedir(), ".pi", `agent.bak-${ts}`);
  copyDir(agentDir, backupDir);
  return backupDir;
}
