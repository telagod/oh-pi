import * as p from "@clack/prompts";
import chalk from "chalk";
import { t } from "../i18n.js";
import type { OhPConfig } from "../types.js";
import type { EnvInfo } from "../utils/detect.js";
import { applyConfig, installPi, backupConfig } from "../utils/install.js";

function countExisting(env: EnvInfo, dir: string): number {
  return env.existingFiles.filter(f => f.startsWith(dir + "/")).length;
}

export async function confirmApply(config: OhPConfig, env: EnvInfo) {
  // ═══ Summary ═══
  const summary = [
    `${t("confirm.providers")}  ${chalk.cyan(config.providers.length > 0 ? config.providers.map(p => p.name).join(", ") : t("confirm.skipped"))}`,
    `${t("confirm.model")}      ${chalk.cyan(config.providers[0]?.defaultModel || t("confirm.skipped"))}`,
    `${t("confirm.theme")}      ${chalk.cyan(config.theme)}`,
    `${t("confirm.keybindings")}${chalk.cyan(config.keybindings)}`,
    `${t("confirm.thinking")}   ${chalk.cyan(config.thinking)}`,
    `${t("confirm.compaction")} ${chalk.cyan(t("confirm.compactionValue", { pct: Math.round((config.compactThreshold ?? 0.75) * 100) }))}`,
    `${t("confirm.extensions")} ${chalk.cyan(config.extensions.join(", ") || t("confirm.none"))}`,
    `${t("confirm.skills")}     ${chalk.cyan(config.skills.join(", ") || t("confirm.none"))}`,
    `${t("confirm.prompts")}    ${chalk.cyan(t("confirm.promptsValue", { count: config.prompts.length }))}`,
    `${t("confirm.agents")}     ${chalk.cyan(config.agents)}`,
  ].join("\n");

  p.note(summary, t("confirm.title"));

  // ═══ Diff (if existing) ═══
  if (env.hasExistingConfig) {
    const diff = [
      `Extensions:  ${chalk.dim(countExisting(env, "extensions"))} ${chalk.yellow("→")} ${chalk.green(config.extensions.length)}`,
      `Skills:      ${chalk.dim(countExisting(env, "skills"))} ${chalk.yellow("→")} ${chalk.green(config.skills.length)}`,
      `Prompts:     ${chalk.dim(countExisting(env, "prompts"))} ${chalk.yellow("→")} ${chalk.green(config.prompts.length)}`,
    ].join("\n");
    p.note(diff, t("confirm.changes"));
  }

  // ═══ Backup prompt ═══
  if (env.hasExistingConfig) {
    const action = await p.select({
      message: t("confirm.existingDetected"),
      options: [
        { value: "backup",    label: t("confirm.backup"),    hint: t("confirm.backupHint") },
        { value: "overwrite", label: t("confirm.overwrite"), hint: t("confirm.overwriteHint") },
        { value: "cancel",    label: t("confirm.cancel"),    hint: t("confirm.cancelHint") },
      ],
    });
    if (p.isCancel(action) || action === "cancel") {
      p.cancel(t("confirm.noChanges"));
      return;
    }

    if (action === "backup") {
      const s = p.spinner();
      s.start(t("confirm.backingUp"));
      const backupDir = backupConfig();
      s.stop(t("confirm.backedUp", { dir: chalk.dim(backupDir) }));
    }
  } else {
    const ok = await p.confirm({ message: t("confirm.apply") });
    if (p.isCancel(ok) || !ok) {
      p.cancel(t("confirm.noChanges"));
      return;
    }
  }

  // ═══ Install pi if needed ═══
  if (!env.piInstalled) {
    const s = p.spinner();
    s.start(t("confirm.installingPi"));
    try {
      installPi();
      s.stop(t("confirm.piInstalled"));
    } catch (e) {
      s.stop(t("confirm.piFailed", { error: String(e) }));
      p.log.warn(t("confirm.piManual"));
    }
  }

  // ═══ Apply ═══
  const s = p.spinner();
  s.start(t("confirm.writing"));
  applyConfig(config);
  s.stop(t("confirm.applied"));

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

  p.note(tree, t("confirm.installed"));

  p.outro(t("confirm.run", { cmd: chalk.cyan.bold("pi") }));
}
