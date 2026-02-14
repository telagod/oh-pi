import type { ExtensionContext, PiSdk } from "@anthropic/pi-sdk";

export default function activate(pi: PiSdk) {
  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    const model = ctx.model;
    const thinking = pi.getThinkingLevel();
    const usage = ctx.getContextUsage();
    const branch = ctx.sessionManager.getBranch();
    const session = ctx.sessionManager.getSessionFile() ?? "ephemeral";
    const cwd = process.cwd().replace(process.env.HOME ?? "", "~");

    // Git branch
    let git = "";
    try {
      const { execSync } = await import("node:child_process");
      git = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", timeout: 2000 }).trim();
    } catch { /* not a git repo */ }

    const modelStr = model ? `${model.provider}/${model.id}` : "no model";
    const thinkStr = thinking !== "off" ? ` • 🧠 ${thinking}` : "";
    const ctxStr = usage ? ` • 📊 ${Math.round(usage.percent)}%` : "";
    const gitStr = git ? ` • 🌿 ${git}` : "";
    const costStr = branch ? ` • $${(branch.totalCost ?? 0).toFixed(3)}` : "";

    const line = `⚡ ${modelStr}${thinkStr}${ctxStr}${costStr} │ 📂 ${cwd}${gitStr} │ 📋 ${session.split("/").pop()}`;

    ctx.ui.setWidget("startup-banner", [line], { placement: "belowEditor" });

    // Auto-hide after 8 seconds
    setTimeout(() => ctx.ui.setWidget("startup-banner", undefined), 8000);
  });
}
