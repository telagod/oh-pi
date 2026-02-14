import * as p from "@clack/prompts";
import type { OhPConfig } from "../types.js";

interface Preset extends Omit<OhPConfig, "providers"> {}

const PRESETS: Record<string, { label: string; hint: string; config: Preset }> = {
  starter: {
    label: "🟢 Starter",
    hint: "New to AI coding? Start here",
    config: {
      theme: "oh-p-dark", keybindings: "default", thinking: "medium",
      extensions: ["safe-guard", "git-guard", "auto-session-name"],
      skills: ["quick-setup", "debug-helper"],
      prompts: ["review", "fix", "explain", "commit"],
      agents: "general-developer",
    },
  },
  pro: {
    label: "🔵 Pro Developer",
    hint: "Full-stack dev with all the bells and whistles",
    config: {
      theme: "catppuccin-mocha", keybindings: "default", thinking: "high",
      extensions: ["safe-guard", "git-guard", "auto-session-name"],
      skills: ["quick-setup", "debug-helper", "git-workflow"],
      prompts: ["review", "fix", "explain", "commit", "test", "refactor", "optimize", "document", "pr"],
      agents: "fullstack-developer",
    },
  },
  security: {
    label: "🟣 Security Researcher",
    hint: "Pentesting, auditing, vulnerability research",
    config: {
      theme: "cyberpunk", keybindings: "default", thinking: "high",
      extensions: ["safe-guard"],
      skills: ["debug-helper"],
      prompts: ["review", "security", "fix", "explain"],
      agents: "security-researcher",
    },
  },
  dataai: {
    label: "🟠 Data & AI Engineer",
    hint: "MLOps, data pipelines, AI applications",
    config: {
      theme: "tokyo-night", keybindings: "default", thinking: "medium",
      extensions: ["safe-guard", "git-guard", "auto-session-name"],
      skills: ["quick-setup", "debug-helper"],
      prompts: ["review", "fix", "explain", "optimize", "document", "test"],
      agents: "data-ai-engineer",
    },
  },
  minimal: {
    label: "🔴 Minimal",
    hint: "Just the core, nothing extra",
    config: {
      theme: "dark", keybindings: "default", thinking: "off",
      extensions: [], skills: [], prompts: [], agents: "general-developer",
    },
  },
  full: {
    label: "⚫ Full Power",
    hint: "Everything installed, ant colony included",
    config: {
      theme: "oh-p-dark", keybindings: "default", thinking: "high",
      extensions: ["safe-guard", "git-guard", "auto-session-name", "ant-colony"],
      skills: ["quick-setup", "debug-helper", "git-workflow", "ant-colony"],
      prompts: ["review", "fix", "explain", "commit", "test", "refactor", "optimize", "security", "document", "pr"],
      agents: "colony-operator",
    },
  },
};

export async function selectPreset(): Promise<Preset> {
  const key = await p.select({
    message: "Choose a preset:",
    options: Object.entries(PRESETS).map(([k, v]) => ({
      value: k,
      label: v.label,
      hint: v.hint,
    })),
  });
  if (p.isCancel(key)) { p.cancel("Cancelled."); process.exit(0); }
  return PRESETS[key]!.config;
}
