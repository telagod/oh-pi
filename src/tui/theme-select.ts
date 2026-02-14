import * as p from "@clack/prompts";
import { THEMES } from "../types.js";

export async function selectTheme(): Promise<string> {
  const theme = await p.select({
    message: "Choose a theme:",
    options: THEMES.map(t => ({
      value: t.name,
      label: `${t.style === "dark" ? "🌙" : "☀️"} ${t.label}`,
    })),
  });
  if (p.isCancel(theme)) { p.cancel("Cancelled."); process.exit(0); }
  return theme;
}
