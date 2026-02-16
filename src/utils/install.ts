import { mkdirSync, readdirSync, copyFileSync, existsSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import type { OhPConfig } from "../types.js";
import { writeProviderEnv, writeModelConfig, writeKeybindings, writeAgents, writeExtensions, writePrompts, writeSkills, writeTheme } from "./writers.js";

/**
 * 确保目录存在，若不存在则递归创建
 */
export function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

/**
 * 增量同步目录：只复制有变化的文件，删除源中不存在的文件
 */
export function syncDir(src: string, dest: string) {
  ensureDir(dest);
  const srcEntries = new Set<string>();
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    srcEntries.add(entry.name);
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      syncDir(srcPath, destPath);
    } else {
      try {
        if (existsSync(destPath) && statSync(destPath).size === statSync(srcPath).size) continue;
      } catch { /* copy anyway */ }
      copyFileSync(srcPath, destPath);
    }
  }
  try {
    for (const entry of readdirSync(dest, { withFileTypes: true })) {
      if (!srcEntries.has(entry.name)) {
        rmSync(join(dest, entry.name), { recursive: true });
      }
    }
  } catch { /* skip */ }
}

/**
 * 递归复制目录及其所有内容
 */
function copyDir(src: string, dest: string) {
  ensureDir(dest);
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 应用 OhP 配置，生成并写入 ~/.pi/agent/ 下的所有配置文件
 */
export function applyConfig(config: OhPConfig) {
  const agentDir = join(homedir(), ".pi", "agent");
  ensureDir(agentDir);

  writeProviderEnv(agentDir, config);
  writeModelConfig(agentDir, config);
  writeKeybindings(agentDir, config);
  writeAgents(agentDir, config);
  writeExtensions(agentDir, config);
  writePrompts(agentDir, config);
  writeSkills(agentDir, config);
  writeTheme(agentDir, config);
}

/**
 * 全局安装 pi-coding-agent，安装失败时抛出异常
 */
export function installPi() {
  try {
    execSync("npm install -g @mariozechner/pi-coding-agent", { stdio: "pipe", timeout: 120000 });
  } catch {
    throw new Error("Failed to install pi-coding-agent");
  }
}

/**
 * 备份 ~/.pi/agent/ 目录到 ~/.pi/agent.bak-{timestamp}/
 * @returns 备份目录路径，若原目录不存在则返回空字符串
 */
export function backupConfig(): string {
  const agentDir = join(homedir(), ".pi", "agent");
  if (!existsSync(agentDir)) return "";
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(homedir(), ".pi", `agent.bak-${ts}`);
  copyDir(agentDir, backupDir);
  return backupDir;
}
