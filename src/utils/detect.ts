import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface EnvInfo {
  piInstalled: boolean;
  piVersion: string | null;
  hasExistingConfig: boolean;
  agentDir: string;
  terminal: string;
  os: string;
  existingFiles: string[];
  configSizeKB: number;
  existingProviders: string[];
}

/**
 * 递归扫描目录，返回所有文件的相对路径列表
 * @param dir - 要扫描的目录路径
 * @param prefix - 路径前缀，用于递归拼接相对路径
 * @returns 文件相对路径数组
 */
function scanDir(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) files.push(...scanDir(join(dir, e.name), rel));
      else files.push(rel);
    }
  } catch { /* skip */ }
  return files;
}

/**
 * 计算目录的总大小（KB）
 * @param dir - 目录路径
 * @returns 目录大小，单位为 KB（四舍五入）
 */
function dirSizeKB(dir: string): number {
  if (!existsSync(dir)) return 0;
  let bytes = 0;
  try {
    for (const f of scanDir(dir)) {
      try { bytes += statSync(join(dir, f)).size; } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return Math.round(bytes / 1024);
}

/**
 * 从 auth.json、settings.json、models.json 中检测已配置的 provider 名称
 * @param agentDir - agent 配置目录路径
 * @returns 已配置的 provider 名称数组
 */
function detectProviders(agentDir: string): string[] {
  const providers: Set<string> = new Set();

  // From auth.json keys
  try {
    const auth = JSON.parse(readFileSync(join(agentDir, "auth.json"), "utf8"));
    for (const key of Object.keys(auth)) providers.add(key);
  } catch { /* skip */ }

  // From settings.json defaultProvider
  try {
    const settings = JSON.parse(readFileSync(join(agentDir, "settings.json"), "utf8"));
    if (settings.defaultProvider) providers.add(settings.defaultProvider);
  } catch { /* skip */ }

  // From models.json custom providers
  try {
    const models = JSON.parse(readFileSync(join(agentDir, "models.json"), "utf8"));
    const providerKeys = models.providers ? Object.keys(models.providers) : Object.keys(models);
    for (const key of providerKeys) providers.add(key);
  } catch { /* skip */ }

  return [...providers];
}

/**
 * 检测当前环境信息，包括 pi 安装状态、版本、配置目录及已配置的 provider
 * @returns 环境信息对象 {@link EnvInfo}
 */
export async function detectEnv(): Promise<EnvInfo> {
  const agentDir = join(homedir(), ".pi", "agent");

  // 并行检测 pi 版本和扫描配置
  const [versionResult, existingFiles] = await Promise.all([
    new Promise<{ installed: boolean; version: string | null }>((resolve) => {
      try {
        const v = execSync("pi --version", { encoding: "utf8", timeout: 3000 }).trim();
        resolve({ installed: true, version: v });
      } catch { resolve({ installed: false, version: null }); }
    }),
    Promise.resolve(scanDir(agentDir)),
  ]);

  return {
    piInstalled: versionResult.installed,
    piVersion: versionResult.version,
    hasExistingConfig: existsSync(join(agentDir, "settings.json")),
    agentDir,
    terminal: process.env.TERM_PROGRAM ?? process.env.TERM ?? "unknown",
    os: process.platform,
    existingFiles,
    configSizeKB: dirSizeKB(agentDir),
    existingProviders: detectProviders(agentDir),
  };
}
