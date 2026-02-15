import * as p from "@clack/prompts";
import { t } from "../i18n.js";
import type { OhPConfig } from "../types.js";

interface Preset extends Omit<OhPConfig, "providers"> {}

const PRESETS: Record<string, { labelKey: string; hintKey: string; config: Preset }> = {
  full: {
    labelKey: "preset.full", hintKey: "preset.fullHint",
    config: {
      theme: "dark", keybindings: "default", thinking: "high",
      extensions: ["safe-guard", "git-guard", "auto-session-name", "custom-footer", "compact-header", "ant-colony", "auto-update", "bg-process"],
      prompts: ["review", "fix", "explain", "commit", "test", "refactor", "optimize", "security", "document", "pr"],
      agents: "colony-operator",
    },
  },
  clean: {
    labelKey: "preset.clean", hintKey: "preset.cleanHint",
    config: {
      theme: "dark", keybindings: "default", thinking: "off",
      extensions: [], prompts: [], agents: "general-developer",
    },
  },
  colony: {
    labelKey: "preset.colony", hintKey: "preset.colonyHint",
    config: {
      theme: "dark", keybindings: "default", thinking: "medium",
      extensions: ["ant-colony", "auto-session-name", "compact-header"],
      prompts: ["review", "fix", "explain", "commit"],
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
