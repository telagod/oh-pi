/**
 * 轻量 import graph — 静态分析 ts/js 文件的依赖关系
 */
import * as fs from "node:fs";
import * as path from "node:path";

export interface ImportGraph {
  /** file → files it imports */
  imports: Map<string, Set<string>>;
  /** file → files that import it */
  importedBy: Map<string, Set<string>>;
}

/** 从 import/require 语句中提取相对路径 */
const IMPORT_RE = /(?:import|export)\s+.*?from\s+['"](\.[^'"]+)['"]/g;
const REQUIRE_RE = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

function resolveImport(from: string, specifier: string, cwd: string): string | null {
  const dir = path.dirname(path.resolve(cwd, from));
  const base = path.resolve(dir, specifier);
  const exts = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"];
  for (const ext of exts) {
    const full = base + ext;
    if (fs.existsSync(full)) return path.relative(cwd, full);
  }
  return null;
}

/**
 * 构建项目的 import graph
 * @param files - 相对于 cwd 的文件路径列表
 * @param cwd - 项目根目录
 */
export function buildImportGraph(files: string[], cwd: string): ImportGraph {
  const imports = new Map<string, Set<string>>();
  const importedBy = new Map<string, Set<string>>();

  for (const file of files) {
    const abs = path.resolve(cwd, file);
    if (!fs.existsSync(abs)) continue;
    let content: string;
    try { content = fs.readFileSync(abs, "utf-8"); } catch { continue; }

    const deps = new Set<string>();
    for (const re of [IMPORT_RE, REQUIRE_RE]) {
      re.lastIndex = 0;
      for (const m of content.matchAll(re)) {
        const resolved = resolveImport(file, m[1], cwd);
        if (resolved) deps.add(resolved);
      }
    }

    imports.set(file, deps);
    for (const dep of deps) {
      if (!importedBy.has(dep)) importedBy.set(dep, new Set());
      importedBy.get(dep)!.add(file);
    }
  }

  return { imports, importedBy };
}

/**
 * 计算文件的依赖深度（被多少文件直接或间接依赖）
 * 深度越高 = 越底层 = 应优先处理
 */
export function dependencyDepth(file: string, graph: ImportGraph): number {
  const visited = new Set<string>();
  const queue = [file];
  while (queue.length > 0) {
    const f = queue.pop()!;
    if (visited.has(f)) continue;
    visited.add(f);
    const dependents = graph.importedBy.get(f);
    if (dependents) for (const d of dependents) queue.push(d);
  }
  return visited.size - 1; // 不算自己
}

/**
 * 检查 taskA 的文件是否依赖 taskB 的文件
 * 即 taskA 的某个文件 import 了 taskB 的某个文件
 */
export function taskDependsOn(taskAFiles: string[], taskBFiles: string[], graph: ImportGraph): boolean {
  for (const a of taskAFiles) {
    const deps = graph.imports.get(a);
    if (deps) {
      for (const b of taskBFiles) {
        if (deps.has(b)) return true;
      }
    }
  }
  return false;
}
