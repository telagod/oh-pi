import * as p from "@clack/prompts";
import { selectLanguage, getLocale } from "./i18n.js";
import { t } from "./i18n.js";
import { welcome } from "./tui/welcome.js";
import { selectMode } from "./tui/mode-select.js";
import { setupProviders } from "./tui/provider-setup.js";
import { selectPreset } from "./tui/preset-select.js";
import { selectTheme } from "./tui/theme-select.js";
import { selectKeybindings } from "./tui/keybinding-select.js";
import { selectExtensions } from "./tui/extension-select.js";
import { selectAgents } from "./tui/agents-select.js";
import { confirmApply } from "./tui/confirm-apply.js";
import { detectEnv, type EnvInfo } from "./utils/detect.js";
import type { OhPConfig } from "./types.js";

/**
 * 主入口函数。检测环境、选择语言、展示欢迎界面，根据用户选择的模式执行对应配置流程，最终确认并应用配置。
 */
export async function run() {
  const env = await detectEnv();
  await selectLanguage();
  welcome(env);

  const mode = await selectMode(env);
  let config: OhPConfig;

  if (mode === "quick") {
    config = await quickFlow(env);
  } else if (mode === "preset") {
    config = await presetFlow(env);
  } else {
    config = await customFlow(env);
  }

  config.locale = getLocale();
  await confirmApply(config, env);
}

/**
 * 快速配置流程。仅需设置提供商和主题，其余选项使用推荐默认值。
 * @param env - 当前检测到的环境信息
 * @returns 生成的配置对象
 */
async function quickFlow(env: EnvInfo): Promise<OhPConfig> {
  const providers = await setupProviders(env);
  return {
    providers,
    theme: "dark",
    keybindings: "default",
    extensions: ["safe-guard", "git-guard", "auto-session-name", "custom-footer", "compact-header", "auto-update"],
    skills: ["quick-setup", "debug-helper", "git-workflow", "context7", "web-search", "web-fetch", "liquid-glass", "glassmorphism", "claymorphism", "neubrutalism"],
    prompts: ["review", "fix", "explain", "commit", "test"],
    agents: "general-developer",
    thinking: "medium",
  };
}

/**
 * 预设配置流程。用户选择一个预设方案，再配置提供商，合并生成最终配置。
 * @param env - 当前检测到的环境信息
 * @returns 生成的配置对象
 */
async function presetFlow(env: EnvInfo): Promise<OhPConfig> {
  const preset = await selectPreset();
  const providers = await setupProviders(env);
  return { ...preset, providers };
}

/**
 * 自定义配置流程。用户逐项选择主题、快捷键、扩展、代理等，并可配置高级选项（如自动压缩阈值）。
 * @param env - 当前检测到的环境信息
 * @returns 生成的配置对象
 */
async function customFlow(env: EnvInfo): Promise<OhPConfig> {
  const providers = await setupProviders(env);
  const theme = await selectTheme();
  const keybindings = await selectKeybindings();
  const extensions = await selectExtensions();
  const agents = await selectAgents();

  // Advanced: auto-compaction threshold
  const wantAdvanced = await p.confirm({
    message: t("advanced.configure"),
    initialValue: false,
  });
  if (p.isCancel(wantAdvanced)) { p.cancel(t("cancelled")); process.exit(0); }

  let compactThreshold = 0.80;
  if (wantAdvanced) {
    const threshold = await p.text({
      message: t("advanced.compactThreshold"),
      placeholder: "75",
      initialValue: "75",
      validate: (v) => {
        const n = Number(v);
        if (isNaN(n) || n < 10 || n > 100) return t("advanced.compactValidation");
        return undefined;
      },
    });
    if (p.isCancel(threshold)) { p.cancel(t("cancelled")); process.exit(0); }
    compactThreshold = Number(threshold) / 100;
  }

  return {
    providers,
    theme,
    keybindings,
    extensions,
    skills: ["quick-setup", "debug-helper", "git-workflow", "context7", "web-search", "web-fetch", "liquid-glass", "glassmorphism", "claymorphism", "neubrutalism"],
    prompts: ["review", "fix", "explain", "commit", "test", "refactor", "optimize", "security", "document", "pr"],
    agents,
    thinking: "medium",
    compactThreshold,
  };
}
