/**
 * oh-pi Compact Header — table-style startup info
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { VERSION } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    ctx.ui.setHeader((_tui, theme) => ({
      render(width: number): string[] {
        const d = (s: string) => theme.fg("dim", s);
        const a = (s: string) => theme.fg("accent", s);

        const cmds = pi.getCommands();
        const prompts = cmds.filter(c => c.source === "prompt").map(c => `/${c.name}`).join("  ");
        const skills = cmds.filter(c => c.source === "skill").map(c => c.name).join("  ");
        const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "no model";
        const thinking = pi.getThinkingLevel();

        const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - visibleWidth(s)));
        const t = (s: string) => truncateToWidth(s, width);

        const c0 = 8, c1 = 14, c2 = 6, c3 = 14, c4 = 6;
        const sep = d(" │ ");

        const rows = [
          [d("version"), a(`v${VERSION}`),  d("esc"), a("interrupt"),   d("S-tab"), a("thinking")],
          [d("model"),   a(model),          d("^C"),  a("clear/exit"),  d("^O"),    a("expand")],
          [d("think"),   a(thinking),       d("^P"),  a("cycle model"), d("^G"),    a("ext editor")],
          [d(""),        a(""),             d("/"),   a("commands"),    d("^V"),    a("paste img")],
          [d(""),        a(""),             d("!"),   a("bash"),        d(""),      a("")],
        ];

        const lines: string[] = [""];
        for (const [k0, v0, k1, v1, k2, v2] of rows) {
          const line = pad(k0, c0) + pad(v0, c1) + sep + pad(k1, c2) + pad(v1, c3) + sep + pad(k2, c4) + v2;
          lines.push(t(line));
        }

        // Prompts and skills below the table
        if (prompts) lines.push(t(`${pad(d("prompts"), c0)}${a(prompts)}`));
        if (skills) lines.push(t(`${pad(d("skills"), c0)}${a(skills)}`));
        lines.push(d("─".repeat(width)));

        return lines;
      },
      invalidate() {},
    }));
  });
}
