import * as p from "@clack/prompts";
import { t } from "../i18n.js";
import { EXTENSIONS } from "../types.js";

export async function selectExtensions(): Promise<string[]> {
  const exts = await p.multiselect({
    message: t("ext.select"),
    options: EXTENSIONS.map(e => ({
      value: e.name,
      label: e.label,
    })),
    initialValues: EXTENSIONS.filter(e => e.default).map(e => e.name),
  });
  if (p.isCancel(exts)) { p.cancel(t("cancelled")); process.exit(0); }
  return exts;
}
