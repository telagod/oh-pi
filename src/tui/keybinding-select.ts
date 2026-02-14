import * as p from "@clack/prompts";
import { t } from "../i18n.js";

export async function selectKeybindings(): Promise<string> {
  const kb = await p.select({
    message: t("kb.select"),
    options: [
      { value: "default", label: t("kb.default"),  hint: t("kb.defaultHint") },
      { value: "vim",     label: t("kb.vim"),      hint: t("kb.vimHint") },
      { value: "emacs",   label: t("kb.emacs"),    hint: t("kb.emacsHint") },
    ],
  });
  if (p.isCancel(kb)) { p.cancel(t("cancelled")); process.exit(0); }
  return kb;
}
