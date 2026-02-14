import * as p from "@clack/prompts";
import type { EnvInfo } from "../utils/detect.js";

export type Mode = "quick" | "custom" | "preset";

export async function selectMode(env: EnvInfo): Promise<Mode> {
  const mode = await p.select({
    message: "How would you like to set up pi?",
    options: [
      { value: "quick" as Mode,  label: "🚀 Quick Setup",  hint: "Recommended defaults, 3 steps" },
      { value: "preset" as Mode, label: "📦 Preset",       hint: "Choose a pre-made configuration" },
      { value: "custom" as Mode, label: "🎛️  Custom",       hint: "Pick everything yourself" },
    ],
  });
  if (p.isCancel(mode)) { p.cancel("Cancelled."); process.exit(0); }
  return mode;
}
