import * as p from "@clack/prompts";
import chalk from "chalk";
import { t } from "../i18n.js";
import type { OhPConfig } from "../types.js";
import type { EnvInfo } from "../utils/detect.js";
import { applyConfig, installPi, backupConfig } from "../utils/install.js";

/**
 * 统计已有配置中指定目录下的文件数量。
 * @param env - 环境信息
 * @param dir - 目录名称前缀
 * @returns 匹配的文件数
 */
function countExisting(env: EnvInfo, dir: string): number {
  return env.existingFiles.filter(f => f.startsWith(dir + "/")).length;
}

/**
 * 展示配置摘要，处理已有配置的备份/覆盖，安装 pi（如需），并应用最终配置。
 * @param config - 用户选择的配置对象
 * @param env - 当前环境信息
 */
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
    `${t("confirm.prompts")}    ${chalk.cyan(t("confirm.promptsValue", { count: config.prompts.length }))}`,
    `${t("confirm.agents")}     ${chalk.cyan(config.agents)}`,
  ].join("\n");

  p.note(summary, t("confirm.title"));

  // ═══ Diff (if existing) ═══
  if (env.hasExistingConfig) {
    const diff = [
      `Extensions:  ${chalk.dim(countExisting(env, "extensions"))} ${chalk.yellow("→")} ${chalk.green(config.extensions.length)}`,
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
    // New user — skip confirmation, apply directly
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
    `${chalk.gray("├── ")}skills/ ${chalk.dim("auto-discovered")}`,
    ...(!["dark", "light"].includes(config.theme) ? [`${chalk.gray("└── ")}themes/ ${chalk.dim(config.theme)}`] : []),
  ].join("\n");

  p.note(tree, t("confirm.installed"));

  p.outro(t("confirm.run", { cmd: chalk.cyan.bold("pi") }));
}
