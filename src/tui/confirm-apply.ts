import * as p from "@clack/prompts";
import chalk from "chalk";
import type { OhPConfig } from "../types.js";
import type { EnvInfo } from "../utils/detect.js";
import { applyConfig, installPi, backupConfig } from "../utils/install.js";

function countExisting(env: EnvInfo, dir: string): number {
  return env.existingFiles.filter(f => f.startsWith(dir + "/")).length;
}

export async function confirmApply(config: OhPConfig, env: EnvInfo) {
  // ═══ Summary ═══
  const summary = [
    `Providers:    ${chalk.cyan(config.providers.map(p => p.name).join(", "))}`,
    `Model:        ${chalk.cyan(config.providers[0]?.defaultModel || "default")}`,
    `Theme:        ${chalk.cyan(config.theme)}`,
    `Keybindings:  ${chalk.cyan(config.keybindings)}`,
    `Thinking:     ${chalk.cyan(config.thinking)}`,
    `Extensions:   ${chalk.cyan(config.extensions.join(", ") || "none")}`,
    `Skills:       ${chalk.cyan(config.skills.join(", ") || "none")}`,
    `Prompts:      ${chalk.cyan(`${config.prompts.length} templates`)}`,
    `AGENTS.md:    ${chalk.cyan(config.agents)}`,
  ].join("\n");

  p.note(summary, "Configuration");

  // ═══ Diff (if existing) ═══
  if (env.hasExistingConfig) {
    const diff = [
      `Extensions:  ${chalk.dim(countExisting(env, "extensions"))} ${chalk.yellow("→")} ${chalk.green(config.extensions.length)}`,
      `Skills:      ${chalk.dim(countExisting(env, "skills"))} ${chalk.yellow("→")} ${chalk.green(config.skills.length)}`,
      `Prompts:     ${chalk.dim(countExisting(env, "prompts"))} ${chalk.yellow("→")} ${chalk.green(config.prompts.length)}`,
    ].join("\n");
    p.note(diff, "⚠ Changes");
  }

  // ═══ Backup prompt ═══
  if (env.hasExistingConfig) {
    const action = await p.select({
      message: "Existing config detected. How to proceed?",
      options: [
        { value: "backup",    label: "📦 Backup & apply",  hint: "Safe — backup first, then overwrite" },
        { value: "overwrite", label: "⚡ Overwrite",        hint: "Replace without backup" },
        { value: "cancel",    label: "✖  Cancel",           hint: "Keep current config" },
      ],
    });
    if (p.isCancel(action) || action === "cancel") {
      p.cancel("No changes made.");
      return;
    }

    if (action === "backup") {
      const s = p.spinner();
      s.start("Backing up ~/.pi/agent/");
      const backupDir = backupConfig();
      s.stop(`Backed up to ${chalk.dim(backupDir)}`);
    }
  } else {
    const ok = await p.confirm({ message: "Apply configuration?" });
    if (p.isCancel(ok) || !ok) {
      p.cancel("No changes made.");
      return;
    }
  }

  // ═══ Install pi if needed ═══
  if (!env.piInstalled) {
    const s = p.spinner();
    s.start("Installing pi-coding-agent");
    try {
      installPi();
      s.stop("pi installed");
    } catch (e) {
      s.stop(`Failed: ${e}`);
      p.log.warn("Run manually: npm install -g @mariozechner/pi-coding-agent");
    }
  }

  // ═══ Apply ═══
  const s = p.spinner();
  s.start("Writing configuration");
  applyConfig(config);
  s.stop("Configuration applied");

  // ═══ Result ═══
  const tree = [
    `${chalk.gray("~/.pi/agent/")}`,
    `${chalk.gray("├── ")}auth.json ${chalk.dim("🔒")}`,
    `${chalk.gray("├── ")}settings.json`,
    ...(config.keybindings !== "default" ? [`${chalk.gray("├── ")}keybindings.json`] : []),
    `${chalk.gray("├── ")}AGENTS.md ${chalk.dim(config.agents)}`,
    ...(config.extensions.length > 0 ? [`${chalk.gray("├── ")}extensions/ ${chalk.dim(`${config.extensions.length} items`)}`] : []),
    ...(config.prompts.length > 0 ? [`${chalk.gray("├── ")}prompts/ ${chalk.dim(`${config.prompts.length} templates`)}`] : []),
    ...(config.skills.length > 0 ? [`${chalk.gray("├── ")}skills/ ${chalk.dim(`${config.skills.length} skills`)}`] : []),
    ...(!["dark", "light"].includes(config.theme) ? [`${chalk.gray("└── ")}themes/ ${chalk.dim(config.theme)}`] : []),
  ].join("\n");

  p.note(tree, "✓ Installed");

  p.outro(`Run ${chalk.cyan.bold("pi")} to start coding!`);
}
