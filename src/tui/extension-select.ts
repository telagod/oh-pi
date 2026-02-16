import * as p from "@clack/prompts";
import { t } from "../i18n.js";
import { EXTENSIONS } from "../registry.js";

/**
 * Prompts the user to select enabled extensions from the available list via a multi-select TUI prompt.
 * Exits the process if the user cancels the selection.
 * @returns A promise that resolves to an array of selected extension names.
 */
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
