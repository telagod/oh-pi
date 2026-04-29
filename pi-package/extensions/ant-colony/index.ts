/**
 * 🐜 蚁群模式 (Ant Colony) — pi 扩展入口
 *
 * Thin entry wrapper. The actual pi integration wiring lives in `pi-extension.ts`.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createAntColonyExtension } from "./pi/extension.js";

export default function antColonyExtension(pi: ExtensionAPI) {
  return createAntColonyExtension(pi);
}
