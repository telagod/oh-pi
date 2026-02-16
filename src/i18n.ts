import * as p from "@clack/prompts";
import { execSync } from "node:child_process";
import type { Locale } from "./types.js";
import { messages } from "./locales.js";

export type { Locale } from "./types.js";

let current: Locale = "en";

/**
 * 根据当前语言环境获取翻译文本，支持变量插值。
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  let text = messages[current]?.[key] ?? messages.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

/** 设置当前语言环境。 */
export function setLocale(locale: Locale) { current = locale; }

/** 获取当前语言环境。 */
export function getLocale(): Locale { return current; }

/** 从环境变量中检测用户语言环境。 */
function detectLocale(): Locale | undefined {
  let lang = (process.env.LANG ?? process.env.LC_ALL ?? process.env.LANGUAGE ?? "").toLowerCase();

  if (!lang && process.platform === "win32") {
    try {
      lang = execSync("powershell -NoProfile -Command \"(Get-Culture).Name\"", { encoding: "utf8", timeout: 3000 }).trim().toLowerCase();
    } catch { /* ignore */ }
  }

  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("fr")) return "fr";
  if (lang.startsWith("en")) return "en";
  return undefined;
}

/** 提示用户选择语言。若能从环境变量自动检测则直接使用，否则弹出交互选择。 */
export async function selectLanguage(): Promise<Locale> {
  const detected = detectLocale();
  if (detected) { setLocale(detected); return detected; }

  const locale = await p.select({
    message: "Language / 语言 / Langue:",
    options: [
      { value: "en" as Locale, label: "English" },
      { value: "zh" as Locale, label: "中文" },
      { value: "fr" as Locale, label: "Français" },
    ],
  });
  if (p.isCancel(locale)) { p.cancel("Cancelled."); process.exit(0); }
  setLocale(locale);
  return locale;
}
