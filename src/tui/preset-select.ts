import * as p from "@clack/prompts";
import { t } from "../i18n.js";
import type { OhPConfig } from "../types.js";

interface Preset extends Omit<OhPConfig, "providers"> {}

const PRESETS: Record<string, { labelKey: string; hintKey: string; config: Preset }> = {
  starter: {
    labelKey: "preset.starter", hintKey: "preset.starterHint",
    config: {
      theme: "dark", keybindings: "default", thinking: "medium",
      extensions: ["safe-guard", "git-guard", "auto-session-name", "custom-footer", "compact-header"],
      skills: ["quick-setup", "debug-helper"],
      prompts: ["review", "fix", "explain", "commit"],
      agents: "general-developer",
    },
  },
  pro: {
    labelKey: "preset.pro", hintKey: "preset.proHint",
    config: {
      theme: "catppuccin-mocha", keybindings: "default", thinking: "high",
      extensions: ["safe-guard", "git-guard", "auto-session-name", "custom-footer", "compact-header"],
      skills: ["quick-setup", "debug-helper", "git-workflow"],
      prompts: ["review", "fix", "explain", "commit", "test", "refactor", "optimize", "document", "pr"],
      agents: "fullstack-developer",
    },
  },
  security: {
    labelKey: "preset.security", hintKey: "preset.securityHint",
    config: {
      theme: "cyberpunk", keybindings: "default", thinking: "high",
      extensions: ["safe-guard", "custom-footer", "compact-header"],
      skills: ["debug-helper"],
      prompts: ["review", "security", "fix", "explain"],
      agents: "security-researcher",
    },
  },
  dataai: {
    labelKey: "preset.dataai", hintKey: "preset.dataaiHint",
    config: {
      theme: "tokyo-night", keybindings: "default", thinking: "medium",
      extensions: ["safe-guard", "git-guard", "auto-session-name", "custom-footer", "compact-header"],
      skills: ["quick-setup", "debug-helper"],
      prompts: ["review", "fix", "explain", "optimize", "document", "test"],
      agents: "data-ai-engineer",
    },
  },
  minimal: {
    labelKey: "preset.minimal", hintKey: "preset.minimalHint",
    config: {
      theme: "dark", keybindings: "default", thinking: "off",
      extensions: [], skills: [], prompts: [], agents: "general-developer",
    },
  },
  full: {
    labelKey: "preset.full", hintKey: "preset.fullHint",
    config: {
      theme: "dark", keybindings: "default", thinking: "high",
      extensions: ["safe-guard", "git-guard", "auto-session-name", "custom-footer", "compact-header", "ant-colony"],
      skills: ["quick-setup", "debug-helper", "git-workflow", "ant-colony"],
      prompts: ["review", "fix", "explain", "commit", "test", "refactor", "optimize", "security", "document", "pr"],
      agents: "colony-operator",
    },
  },
};

export async function selectPreset(): Promise<Preset> {
  const key = await p.select({
    message: t("preset.select"),
    options: Object.entries(PRESETS).map(([k, v]) => ({
      value: k,
      label: t(v.labelKey),
      hint: t(v.hintKey),
    })),
  });
  if (p.isCancel(key)) { p.cancel(t("cancelled")); process.exit(0); }
  return PRESETS[key]!.config;
}
