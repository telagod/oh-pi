/**
 * 资源路径解析 — 解耦 install.ts 对 pi-package/ 目录的硬编码引用
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RESOURCES = join(PKG_ROOT, "pi-package");

export const resources = {
  agent:     (name: string) => join(RESOURCES, "agents", `${name}.md`),
  extension: (name: string) => join(RESOURCES, "extensions", name),
  extensionFile: (name: string) => join(RESOURCES, "extensions", `${name}.ts`),
  prompt:    (name: string) => join(RESOURCES, "prompts", `${name}.md`),
  skill:     (name: string) => join(RESOURCES, "skills", name),
  theme:     (name: string) => join(RESOURCES, "themes", `${name}.json`),
};
