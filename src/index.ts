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

async function quickFlow(env: EnvInfo): Promise<OhPConfig> {
  const providers = await setupProviders(env);
  const theme = await selectTheme();
  return {
    providers,
    theme,
    keybindings: "default",
    extensions: ["safe-guard", "git-guard", "auto-session-name", "custom-footer", "startup-banner"],
    skills: ["quick-setup", "debug-helper", "git-workflow"],
    prompts: ["review", "fix", "explain", "commit", "test"],
    agents: "general-developer",
    thinking: "medium",
  };
}

async function presetFlow(env: EnvInfo): Promise<OhPConfig> {
  const preset = await selectPreset();
  const providers = await setupProviders(env);
  return { ...preset, providers };
}

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

  let compactThreshold = 0.75;
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
    skills: ["quick-setup", "debug-helper", "git-workflow"],
    prompts: ["review", "fix", "explain", "commit", "test", "refactor", "optimize", "security", "document", "pr"],
    agents,
    thinking: "medium",
    compactThreshold,
  };
}
