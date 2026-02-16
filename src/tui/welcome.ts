import * as p from "@clack/prompts";
import chalk from "chalk";
import { t } from "../i18n.js";
import type { EnvInfo } from "../utils/detect.js";

/**
 * 展示欢迎界面，显示 pi 安装状态、环境信息及已有配置概况。
 * @param {EnvInfo} env - 当前检测到的环境信息
 */
export function welcome(env: EnvInfo) {
  console.clear();
  p.intro(chalk.cyan.bold(" oh-pi ") + chalk.dim(t("welcome.title")));

  if (env.piInstalled) {
    p.log.success(t("welcome.piDetected", { version: env.piVersion ?? "" }));
  } else {
    p.log.warn(t("welcome.piNotFound"));
  }

  p.log.info(t("welcome.envInfo", { terminal: env.terminal, os: env.os, node: process.version }));

  if (env.existingProviders.length > 0) {
    p.log.info(t("welcome.existingProviders", { providers: env.existingProviders.join(", ") }));
  }

  if (env.hasExistingConfig) {
    p.note(
      t("welcome.existingConfigDetail", { count: env.existingFiles.length, size: env.configSizeKB }) + "\n" +
      categorize(env.existingFiles),
      t("welcome.existingConfig"),
    );
  }
}

/**
 * 按顶层目录分类统计文件数量，返回格式化字符串。
 * @param {string[]} files - 文件相对路径列表
 * @returns {string} 分类统计字符串，如 "extensions (3)  prompts (5)"
 */
function categorize(files: string[]): string {
  const cats: Record<string, number> = {};
  for (const f of files) {
    const cat = f.includes("/") ? f.split("/")[0] : f;
    cats[cat] = (cats[cat] || 0) + 1;
  }
  return Object.entries(cats).map(([k, v]) => `${k} (${v})`).join("  ");
}
