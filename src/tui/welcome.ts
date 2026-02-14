import * as p from "@clack/prompts";
import chalk from "chalk";
import { t } from "../i18n.js";
import type { EnvInfo } from "../utils/detect.js";

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

function categorize(files: string[]): string {
  const cats: Record<string, number> = {};
  for (const f of files) {
    const cat = f.includes("/") ? f.split("/")[0] : f;
    cats[cat] = (cats[cat] || 0) + 1;
  }
  return Object.entries(cats).map(([k, v]) => `${k} (${v})`).join("  ");
}
