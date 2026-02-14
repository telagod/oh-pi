import * as p from "@clack/prompts";

export async function selectKeybindings(): Promise<string> {
  const kb = await p.select({
    message: "Keybinding scheme:",
    options: [
      { value: "default", label: "⌨️  Default",  hint: "Pi standard keybindings" },
      { value: "vim",     label: "🟢 Vim",      hint: "Alt+hjkl navigation" },
      { value: "emacs",   label: "🔵 Emacs",    hint: "Ctrl+pnbf navigation" },
    ],
  });
  if (p.isCancel(kb)) { p.cancel("Cancelled."); process.exit(0); }
  return kb;
}
