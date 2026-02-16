#!/usr/bin/env node
/**
 * @module oh-pi CLI 入口脚本
 * 处理 Windows 终端 UTF-8 编码，然后启动主流程。
 */
import { execSync } from "node:child_process";

// Windows terminals default to non-UTF-8 codepage (e.g. GBK/CP936),
// causing garbled emoji and Unicode output. Force UTF-8 before any output.
if (process.platform === "win32") {
  try { execSync("chcp 65001", { stdio: "ignore" }); } catch {}
}

import { run } from "../index.js";
run().catch((e) => { console.error(e); process.exit(1); });
