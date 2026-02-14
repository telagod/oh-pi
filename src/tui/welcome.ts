import * as p from "@clack/prompts";
import chalk from "chalk";
import type { EnvInfo } from "../utils/detect.js";

export function welcome(env: EnvInfo) {
  console.clear();
  p.intro(chalk.cyan.bold(" oh-pi ") + chalk.dim("— one-click setup for pi agent"));

  if (env.piInstalled) {
    p.log.success(`pi ${env.piVersion} detected`);
  } else {
    p.log.warn("pi not found — will install");
  }

  p.log.info(`${env.terminal} │ ${env.os} │ Node ${process.version}`);

  if (env.hasExistingConfig) {
    p.note(
      `${env.existingFiles.length} files (${env.configSizeKB}KB) at ~/.pi/agent/\n` +
      categorize(env.existingFiles),
      "⚠ Existing config found",
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
