import * as p from "@clack/prompts";
import { EXTENSIONS } from "../types.js";

export async function selectExtensions(): Promise<string[]> {
  const exts = await p.multiselect({
    message: "Select extensions:",
    options: EXTENSIONS.map(e => ({
      value: e.name,
      label: e.label,
    })),
    initialValues: EXTENSIONS.filter(e => e.default).map(e => e.name),
  });
  if (p.isCancel(exts)) { p.cancel("Cancelled."); process.exit(0); }
  return exts;
}
