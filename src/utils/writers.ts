import { writeFileSync, readFileSync, copyFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { OhPConfig } from "../types.js";
import { KEYBINDING_SCHEMES, MODEL_CAPABILITIES, PROVIDERS } from "../registry.js";
import { resources } from "./resources.js";
import { ensureDir, syncDir } from "./install.js";

/** 步骤 1-2: 生成 auth.json + settings.json */
export function writeProviderEnv(agentDir: string, config: OhPConfig) {
  // auth.json
  const authProviders = config.providers.filter(p => !p.baseUrl && p.apiKey !== "none");
  if (authProviders.length > 0) {
    const auth: Record<string, { type: string; key: string }> = {};
    for (const p of authProviders) {
      auth[p.name] = { type: "api_key", key: p.apiKey };
    }
    writeFileSync(join(agentDir, "auth.json"), JSON.stringify(auth, null, 2), { mode: 0o600 });
  }

  // settings.json
  const primary = config.providers.find(p => p.baseUrl && p.defaultModel) ?? config.providers[0];
  const providerInfo = primary ? PROVIDERS[primary.name] : undefined;
  const primaryModelId = primary?.defaultModel ?? providerInfo?.models[0];
  const caps = primaryModelId ? MODEL_CAPABILITIES[primaryModelId] : undefined;
  const ctxWindow = caps?.contextWindow ?? primary?.contextWindow ?? 128000;
  const reserveTokens = Math.max(16384, Math.round(ctxWindow * 0.15));
  const keepRecentTokens = Math.max(16384, Math.round(ctxWindow * 0.15));
  const primaryModel = primary?.defaultModel ?? providerInfo?.models[0];
  const settings: Record<string, unknown> = {
    ...(primary ? { defaultProvider: primary.name, defaultModel: primaryModel } : {}),
    defaultThinkingLevel: config.thinking,
    theme: config.theme,
    enableSkillCommands: true,
    compaction: { enabled: true, reserveTokens, keepRecentTokens },
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
}

/** 步骤 3: 生成 models.json（自定义端点） */
export function writeModelConfig(agentDir: string, config: OhPConfig) {
  const customProviders = config.providers.filter(p => p.baseUrl);
  if (customProviders.length === 0) return;

  const providers: Record<string, unknown> = {};
  for (const cp of customProviders) {
    const isBuiltin = !!PROVIDERS[cp.name];
    if (isBuiltin && !cp.discoveredModels?.length) {
      const entry: Record<string, unknown> = { baseUrl: cp.baseUrl };
      if (cp.apiKey !== "none") entry.apiKey = cp.apiKey;
      providers[cp.name] = entry;
    } else {
      const entry: Record<string, unknown> = {
        baseUrl: cp.baseUrl,
        api: cp.api ?? "openai-completions",
      };
      if (cp.apiKey !== "none") entry.apiKey = cp.apiKey;

      if (cp.discoveredModels?.length) {
        entry.models = cp.discoveredModels.map(m => ({
          id: m.id, name: m.id, reasoning: m.reasoning, input: m.input,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: m.contextWindow, maxTokens: m.maxTokens,
        }));
      } else if (cp.defaultModel) {
        const caps = MODEL_CAPABILITIES[cp.defaultModel];
        entry.models = [{
          id: cp.defaultModel, name: cp.defaultModel,
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

/** 步骤 4: 生成 keybindings.json */
export function writeKeybindings(agentDir: string, config: OhPConfig) {
  const kb = KEYBINDING_SCHEMES[config.keybindings];
  if (kb && Object.keys(kb).length > 0) {
    writeFileSync(join(agentDir, "keybindings.json"), JSON.stringify(kb, null, 2));
  }
}

/** 步骤 5: 生成 AGENTS.md */
export function writeAgents(agentDir: string, config: OhPConfig) {
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
}

/** 步骤 6: 复制扩展 */
export function writeExtensions(agentDir: string, config: OhPConfig) {
  const extDir = join(agentDir, "extensions");
  ensureDir(extDir);
  for (const ext of config.extensions) {
    const dirSrc = resources.extension(ext);
    const fileSrc = resources.extensionFile(ext);
    if (existsSync(dirSrc) && statSync(dirSrc).isDirectory()) {
      syncDir(dirSrc, join(extDir, ext));
    } else {
      try { copyFileSync(fileSrc, join(extDir, `${ext}.ts`)); } catch { /* skip */ }
    }
  }
}

/** 步骤 7: 复制提示词 */
export function writePrompts(agentDir: string, config: OhPConfig) {
  const promptDir = join(agentDir, "prompts");
  ensureDir(promptDir);
  for (const p of config.prompts) {
    const src = resources.prompt(p);
    try { copyFileSync(src, join(promptDir, `${p}.md`)); } catch { /* skip */ }
  }
}

/** 步骤 8: 同步 skills */
export function writeSkills(agentDir: string, _config: OhPConfig) {
  const skillDir = join(agentDir, "skills");
  const skillsSrcDir = resources.skillsDir();
  try {
    if (existsSync(skillsSrcDir)) syncDir(skillsSrcDir, skillDir);
  } catch { /* skills dir not found, skip */ }
}

/** 步骤 9: 复制主题 */
export function writeTheme(agentDir: string, config: OhPConfig) {
  const themeDir = join(agentDir, "themes");
  ensureDir(themeDir);
  const themeSrc = resources.theme(config.theme);
  try { copyFileSync(themeSrc, join(themeDir, `${config.theme}.json`)); } catch { /* built-in theme */ }
}
