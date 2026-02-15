/**
 * oh-pi Compact Header — replaces verbose startup with dense info block
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    ctx.ui.setHeader((_tui, theme) => ({
      render(width: number): string[] {
        const dim = (s: string) => theme.fg("dim", s);
        const acc = (s: string) => theme.fg("accent", s);
        const mut = (s: string) => theme.fg("muted", s);

        // Gather info
        const cmds = pi.getCommands();
        const prompts = cmds.filter(c => c.source === "prompt").map(c => `/${c.name}`);
        const skills = cmds.filter(c => c.source === "skill").map(c => c.name);
        const exts = cmds.filter(c => c.source === "extension").map(c => `/${c.name}`);

        const lines: string[] = [];

        // Line 1: keys
        const keys = [
          `${acc("esc")} interrupt`,
          `${acc("ctrl+c")} clear/exit`,
          `${acc("shift+tab")} thinking`,
          `${acc("ctrl+p")} model`,
          `${acc("ctrl+o")} expand`,
          `${acc("/")} commands`,
          `${acc("!")} bash`,
        ].join(dim("  "));
        lines.push(truncateToWidth(keys, width));

        // Line 2: prompts + skills
        const parts: string[] = [];
        if (prompts.length) parts.push(`${mut("prompts")} ${acc(prompts.join(" "))}`);
        if (skills.length) parts.push(`${mut("skills")} ${acc(skills.join(" "))}`);
        if (exts.length) parts.push(`${mut("cmds")} ${acc(exts.join(" "))}`);
        if (parts.length) lines.push(truncateToWidth(parts.join(dim("  ")), width));

        return ["", ...lines, ""];
      },
      invalidate() {},
    }));
  });
}
