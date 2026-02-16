import * as p from "@clack/prompts";
import { t } from "../i18n.js";
import { THEMES } from "../types.js";

/**
 * Prompts the user to select a theme from the available themes list.
 * Exits the process if the user cancels the selection.
 * @returns The name of the selected theme.
 */
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
