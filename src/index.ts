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

  await confirmApply(config, env);
}

async function quickFlow(env: EnvInfo): Promise<OhPConfig> {
  const providers = await setupProviders();
  const theme = "oh-p-dark";
  return {
    providers,
    theme,
    keybindings: "default",
    extensions: ["safe-guard", "git-guard", "auto-session-name"],
    skills: ["quick-setup", "debug-helper", "git-workflow"],
    prompts: ["review", "fix", "explain", "commit", "test"],
    agents: "general-developer",
    thinking: "medium",
  };
}

async function presetFlow(env: EnvInfo): Promise<OhPConfig> {
  const preset = await selectPreset();
  const providers = await setupProviders();
  return { ...preset, providers };
}

async function customFlow(env: EnvInfo): Promise<OhPConfig> {
  const providers = await setupProviders();
  const theme = await selectTheme();
  const keybindings = await selectKeybindings();
  const extensions = await selectExtensions();
  const agents = await selectAgents();
  return {
    providers,
    theme,
    keybindings,
    extensions,
    skills: ["quick-setup", "debug-helper", "git-workflow"],
    prompts: ["review", "fix", "explain", "commit", "test", "refactor", "optimize", "security", "document", "pr"],
    agents,
    thinking: "medium",
  };
}
