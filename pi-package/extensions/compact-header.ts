/**
 * oh-pi Compact Header — aligned, scannable startup info
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { VERSION } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";

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
        const t = (s: string) => truncateToWidth(s, width);
        const bar = d("─".repeat(width));

        // Column-aligned key=value pairs
        const col1 = [
          [d("version"), a(`v${VERSION}`)],
          [d("  model"), a(model)],
          [d("  think"), a(thinking)],
        ];
        const col2 = [
          [a("esc"), d("interrupt")],
          [a("^C"), d("clear/exit")],
          [a("^P"), d("cycle model")],
        ];
        const col3 = [
          [a("S-tab"), d("thinking")],
          [a("^O"), d("expand")],
          [a("^G"), d("ext editor")],
        ];
        const col4 = [
          [a("/"), d("commands")],
          [a("!"), d("bash")],
          [a("^V"), d("paste img")],
        ];

        const lines: string[] = [""];
        for (let i = 0; i < 3; i++) {
          const [k1, v1] = col1[i];
          const [k2, v2] = col2[i];
          const [k3, v3] = col3[i];
          const [k4, v4] = col4[i];
          lines.push(t(`${k1} ${v1}    ${k2} ${v2}    ${k3} ${v3}    ${k4} ${v4}`));
        }

        if (prompts) lines.push(t(`${d("prompts")} ${a(prompts)}`));
        if (skills) lines.push(t(`${d(" skills")} ${a(skills)}`));
        lines.push(bar);

        return lines;
      },
      invalidate() {},
    }));
  });
}
