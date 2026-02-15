/**
 * oh-pi Startup Banner Extension
 *
 * Replaces the built-in verbose header with a compact one-line info display.
 * Auto-restores the default header after 8 seconds.
 */
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const model = ctx.model;
    const thinking = pi.getThinkingLevel();
    const usage = ctx.getContextUsage();
    const cwd = process.cwd().replace(process.env.HOME ?? "", "~");

    // Sum cost from branch
    let totalCost = 0;
    for (const e of ctx.sessionManager.getBranch()) {
      if (e.type === "message" && e.message.role === "assistant") {
        totalCost += (e.message as AssistantMessage).usage.cost.total;
      }
    }

    // Git branch
    let git = "";
    try {
      const { stdout } = await pi.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { timeout: 2000 });
      git = stdout.trim();
    } catch { /* not a git repo */ }

    const modelStr = model ? `${model.provider}/${model.id}` : "no model";
    const thinkStr = thinking !== "off" ? ` • 🧠 ${thinking}` : "";
    const ctxStr = usage ? ` • 📊 ${Math.round(usage.percent)}%` : "";
    const gitStr = git ? ` • 🌿 ${git}` : "";
    const costStr = totalCost > 0 ? ` • $${totalCost.toFixed(3)}` : "";

    const session = ctx.sessionManager.getSessionFile?.() ?? "ephemeral";
    const sessionName = session.split("/").pop();

    const line = `⚡ ${modelStr}${thinkStr}${ctxStr}${costStr} │ 📂 ${cwd}${gitStr} │ 📋 ${sessionName}`;

    ctx.ui.setHeader((_tui, theme) => ({
      render(_width: number): string[] {
        return ["", theme.fg("accent", line), ""];
      },
      invalidate() {},
    }));

    // Restore default header after 8 seconds
    setTimeout(() => ctx.ui.setHeader(undefined), 8000);
  });
}
