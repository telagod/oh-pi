import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";
import type { BackgroundColony } from "./ui.js";
import { calcProgress, trim } from "./ui.js";
import { casteIcon, formatCost, formatDuration, formatTokens, progressBar, statusIcon, statusLabel } from "../core/ui.js";

export function registerColonyShortcuts(pi: ExtensionAPI, getActiveColony: () => BackgroundColony | null) {
  pi.registerShortcut("ctrl+shift+a", {
    description: "Show ant colony details",
    async handler(ctx) {
      if (!getActiveColony()) {
        ctx.ui.notify("No colony is currently running.", "info");
        return;
      }
      await ctx.ui.custom<void>((tui, theme, _kb, done) => {
        let cachedWidth: number | undefined;
        let cachedLines: string[] | undefined;
        let currentTab: "tasks" | "streams" | "log" = "tasks";
        let taskFilter: "all" | "active" | "done" | "failed" = "all";
        const buildLines = (width: number): string[] => {
          const c = getActiveColony();
          if (!c) return [theme.fg("muted", "  No colony running.")];
          const lines: string[] = [];
          const w = width - 2;
          const elapsed = c.state ? formatDuration(Date.now() - c.state.createdAt) : "0s";
          const m = c.state?.metrics;
          const phase = c.state?.status || "scouting";
          const progress = calcProgress(m);
          const pct = Math.round(progress * 100);
          const cost = m ? formatCost(m.totalCost) : "$0";
          const activeAnts = c.antStreams.size;
          const barWidth = Math.max(10, Math.min(24, w - 28));
          lines.push(theme.fg("accent", theme.bold(`  🐜 Colony Details`)) + theme.fg("muted", ` │ ${elapsed} │ ${cost}`));
          lines.push(theme.fg("muted", `  Goal: ${trim(c.goal, w - 8)}`));
          lines.push(`  ${statusIcon(phase)} ${theme.bold(statusLabel(phase))} │ ${m ? `${m.tasksDone}/${m.tasksTotal}` : "0/0"} │ ${pct}% │ ⚡${activeAnts}`);
          lines.push(theme.fg("muted", `  ${progressBar(progress, barWidth)} ${pct}%`));
          if (c.phase && c.phase !== "initializing") lines.push(theme.fg("muted", `  Phase: ${trim(c.phase, w - 10)}`));
          lines.push("");
          const tabs: Array<{ key: "tasks" | "streams" | "log"; hotkey: string; label: string }> = [
            { key: "tasks", hotkey: "1", label: "Tasks" },
            { key: "streams", hotkey: "2", label: "Streams" },
            { key: "log", hotkey: "3", label: "Log" },
          ];
          const tabLine = tabs.map((t) => {
            const label = `[${t.hotkey}] ${t.label}`;
            return currentTab === t.key ? theme.fg("accent", theme.bold(label)) : theme.fg("muted", label);
          }).join("  ");
          lines.push(`  ${tabLine}`);
          lines.push("");
          const tasks = c.state?.tasks || [];
          const streams = Array.from(c.antStreams.values());
          if (currentTab === "tasks") {
            const counts = { done: tasks.filter(t => t.status === "done").length, active: tasks.filter(t => t.status === "active").length, failed: tasks.filter(t => t.status === "failed").length, pending: tasks.filter(t => t.status === "pending" || t.status === "claimed" || t.status === "blocked").length };
            lines.push(theme.fg("accent", "  Tasks"));
            lines.push(theme.fg("muted", `  done:${counts.done} │ active:${counts.active} │ pending:${counts.pending} │ failed:${counts.failed}`));
            lines.push(theme.fg("muted", "  Filter: [0] all  [a] active  [d] done  [f] failed"));
            lines.push(theme.fg("muted", `  Current filter: ${taskFilter.toUpperCase()}`));
            lines.push("");
            const filtered = tasks.filter(t => taskFilter === "all" ? true : taskFilter === "active" ? t.status === "active" : taskFilter === "done" ? t.status === "done" : t.status === "failed");
            if (filtered.length === 0) lines.push(theme.fg("muted", "  (no tasks match current filter)"));
            else {
              for (const t of filtered.slice(0, 16)) {
                const icon = t.status === "done" ? theme.fg("success", "✓") : t.status === "failed" ? theme.fg("error", "✗") : t.status === "active" ? theme.fg("warning", "●") : theme.fg("dim", "○");
                const dur = t.finishedAt && t.startedAt ? theme.fg("dim", ` ${formatDuration(t.finishedAt - t.startedAt)}`) : "";
                lines.push(`  ${icon} ${casteIcon(t.caste)} ${theme.fg("text", trim(t.title, w - 12))}${dur}`);
              }
              if (filtered.length > 16) lines.push(theme.fg("muted", `  ⋯ +${filtered.length - 16} more`));
            }
            lines.push("");
          }
          if (currentTab === "streams") {
            lines.push(theme.fg("accent", `  Active Ant Streams (${streams.length})`));
            lines.push(theme.fg("muted", "  Shows latest line + token count for active ants"));
            lines.push("");
            if (streams.length === 0) lines.push(theme.fg("muted", "  (no active streams right now)"));
            else {
              for (const s of streams.slice(0, 10)) {
                const excerpt = trim((s.lastLine || "...").replace(/\s+/g, " "), Math.max(20, w - 24));
                lines.push(`  ${casteIcon(s.caste)} ${theme.fg("muted", s.antId.slice(0, 12))} ${theme.fg("muted", `${formatTokens(s.tokens)}t`)} ${theme.fg("text", excerpt)}`);
              }
              if (streams.length > 10) lines.push(theme.fg("muted", `  ⋯ +${streams.length - 10} more streams`));
            }
            lines.push("");
          }
          if (currentTab === "log") {
            const failedTasks = tasks.filter(t => t.status === "failed");
            if (failedTasks.length > 0) {
              lines.push(theme.fg("warning", `  Warnings (${failedTasks.length})`));
              for (const t of failedTasks.slice(0, 4)) lines.push(`  ${theme.fg("error", "✗")} ${theme.fg("text", trim(t.title, w - 8))}`);
              if (failedTasks.length > 4) lines.push(theme.fg("muted", `  ⋯ +${failedTasks.length - 4} more failed tasks`));
              lines.push("");
            }
            const recentLogs = c.logs.slice(-12);
            lines.push(theme.fg("accent", "  Recent Signals"));
            if (recentLogs.length === 0) lines.push(theme.fg("muted", "  (no signal logs yet)"));
            else {
              const now = Date.now();
              for (const log of recentLogs) {
                const age = formatDuration(Math.max(0, now - log.timestamp));
                const levelIcon = log.level === "error" ? theme.fg("error", "✗") : log.level === "warning" ? theme.fg("warning", "!") : theme.fg("muted", "•");
                lines.push(`  ${levelIcon} ${theme.fg("muted", age)} ${theme.fg("text", trim(log.text, w - 12))}`);
              }
            }
            lines.push("");
          }
          lines.push(theme.fg("muted", "  [1/2/3] switch tabs │ [0/a/d/f] task filter │ esc close"));
          return lines;
        };
        let timer: ReturnType<typeof setInterval> | null = setInterval(() => { cachedWidth = undefined; cachedLines = undefined; tui.requestRender(); }, 1000);
        const cleanup = () => { if (timer) { clearInterval(timer); timer = null; } };
        return {
          render(width: number): string[] {
            if (cachedLines && cachedWidth === width) return cachedLines;
            cachedLines = buildLines(width); cachedWidth = width; return cachedLines;
          },
          invalidate() { cachedWidth = undefined; cachedLines = undefined; cleanup(); },
          handleInput(data: string) {
            if (matchesKey(data, "escape")) { cleanup(); done(undefined); return; }
            if (data === "1") currentTab = "tasks";
            else if (data === "2") currentTab = "streams";
            else if (data === "3") currentTab = "log";
            else if (data === "0") taskFilter = "all";
            else if (data.toLowerCase() === "a") taskFilter = "active";
            else if (data.toLowerCase() === "d") taskFilter = "done";
            else if (data.toLowerCase() === "f") taskFilter = "failed";
            else return;
            cachedWidth = undefined; cachedLines = undefined; tui.requestRender();
          },
        };
      }, { overlay: true, overlayOptions: { anchor: "center", width: "80%", maxHeight: "80%" } });
    },
  });
}
