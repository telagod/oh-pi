/**
 * oh-pi Compact Header — replaces verbose startup with dense, styled info block
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
        const m = (s: string) => theme.fg("muted", s);
        const bar = d("─".repeat(width));

        const cmds = pi.getCommands();
        const prompts = cmds.filter(c => c.source === "prompt").map(c => `/${c.name}`);
        const skills = cmds.filter(c => c.source === "skill").map(c => c.name);

        const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "no model";
        const thinking = pi.getThinkingLevel();

        // Line 1: pi version + model + thinking
        const l1 = `${a("pi")} ${d(`v${VERSION}`)}  ${m(model)}  ${d("thinking:")}${a(thinking)}`;

        // Line 2: keybindings (compact)
        const keys = [
          `${a("esc")}${d(":")}interrupt`,
          `${a("^C")}${d(":")}clear`,
          `${a("^P")}${d(":")}model`,
          `${a("S-tab")}${d(":")}thinking`,
          `${a("^O")}${d(":")}expand`,
          `${a("/")}${d(":")}cmd`,
          `${a("!")}${d(":")}bash`,
          `${a("^G")}${d(":")}editor`,
        ].join(d("  "));

        // Line 3: prompts + skills
        const parts: string[] = [];
        if (prompts.length) parts.push(`${d("prompts")} ${a(prompts.join(" "))}`);
        if (skills.length) parts.push(`${d("skills")} ${a(skills.join(" "))}`);

        const lines = [
          "",
          truncateToWidth(l1, width),
          truncateToWidth(keys, width),
        ];
        if (parts.length) lines.push(truncateToWidth(parts.join(d("  │  ")), width));
        lines.push(bar);

        return lines;
      },
      invalidate() {},
    }));
  });
}
