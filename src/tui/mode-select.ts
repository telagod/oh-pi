import * as p from "@clack/prompts";
import { t } from "../i18n.js";
import type { EnvInfo } from "../utils/detect.js";

export type Mode = "quick" | "custom" | "preset";

export async function selectMode(env: EnvInfo): Promise<Mode> {
  const mode = await p.select({
    message: t("mode.select"),
    options: [
      { value: "quick" as Mode,  label: t("mode.quick"),  hint: t("mode.quickHint") },
      { value: "preset" as Mode, label: t("mode.preset"), hint: t("mode.presetHint") },
      { value: "custom" as Mode, label: t("mode.custom"), hint: t("mode.customHint") },
    ],
  });
  if (p.isCancel(mode)) { p.cancel(t("cancelled")); process.exit(0); }
  return mode;
}
