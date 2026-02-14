import * as p from "@clack/prompts";
import { t } from "../i18n.js";
import { THEMES } from "../types.js";

export async function selectTheme(): Promise<string> {
  const theme = await p.select({
    message: t("theme.select"),
    options: THEMES.map(th => ({
      value: th.name,
      label: `${th.style === "dark" ? "🌙" : "☀️"} ${th.label}`,
    })),
  });
  if (p.isCancel(theme)) { p.cancel(t("cancelled")); process.exit(0); }
  return theme;
}
