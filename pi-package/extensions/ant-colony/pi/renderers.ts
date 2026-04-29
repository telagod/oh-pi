import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, Container } from "@mariozechner/pi-tui";
import { trim } from "./ui.js";
import { statusIcon, statusLabel } from "../core/ui.js";

export function registerColonyRenderers(pi: ExtensionAPI) {
  pi.registerMessageRenderer("ant-colony-progress", (message, theme) => {
    const content = typeof message.content === "string" ? message.content : "";
    const line = content.split("\n")[0] || content;
    const phaseMatch = line.match(/\[COLONY_SIGNAL:([A-Z_]+)\]/);
    const text = line.replace(/\[COLONY_SIGNAL:[A-Z_]+\]\s*/, "").trim();

    const phase = phaseMatch?.[1]?.toLowerCase() || "working";
    const icon = statusIcon(phase);
    const label = statusLabel(phase);

    const body = trim(text, 120);
    const coloredBody = phase === "failed"
      ? theme.fg("error", body)
      : phase === "budget_exceeded"
        ? theme.fg("warning", body)
        : phase === "done" || phase === "complete"
          ? theme.fg("success", body)
          : theme.fg("muted", body);

    return new Text(`${icon} ${theme.fg("toolTitle", theme.bold(label))} ${coloredBody}`, 0, 0);
  });

  pi.registerMessageRenderer("ant-colony-report", (message, theme) => {
    const content = typeof message.content === "string" ? message.content : "";
    const container = new Container();

    const durationMatch = content.match(/\*\*Duration:\*\* (.+)/);
    const ok = content.includes("✅ done");

    container.addChild(new Text(
      (ok ? theme.fg("success", "✓") : theme.fg("error", "✗")) + " " +
      theme.fg("toolTitle", theme.bold("🐜 Ant Colony Report")) +
      (durationMatch ? theme.fg("muted", ` │ ${durationMatch[1]}`) : ""),
      0, 0,
    ));

    const taskLines = content.split("\n").filter(l => l.startsWith("- ✓") || l.startsWith("- ✗"));
    for (const l of taskLines.slice(0, 8)) {
      const icon = l.startsWith("- ✓") ? theme.fg("success", "✓") : theme.fg("error", "✗");
      container.addChild(new Text(`  ${icon} ${theme.fg("muted", l.slice(4).trim().slice(0, 70))}`, 0, 0));
    }
    if (taskLines.length > 8) {
      container.addChild(new Text(theme.fg("muted", `  ⋯ +${taskLines.length - 8} more`), 0, 0));
    }

    const metricsLines = content.split("\n").filter(l => l.startsWith("- ") && !l.startsWith("- ✓") && !l.startsWith("- ✗") && !l.startsWith("- ["));
    if (metricsLines.length > 0) {
      container.addChild(new Text(theme.fg("muted", `  ${metricsLines.map(l => l.slice(2)).join(" │ ")}`), 0, 0));
    }

    return container;
  });
}
