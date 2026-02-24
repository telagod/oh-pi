import type { ColonyState } from "./types.js";

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

export function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  return n < 1000 ? `${n}` : n < 1000000 ? `${(n / 1000).toFixed(1)}k` : `${(n / 1000000).toFixed(1)}M`;
}

export function statusIcon(status: string): string {
  const icons: Record<string, string> = {
    scouting: "🔍", planning_recovery: "♻️", working: "⚒️", reviewing: "🛡️",
    done: "✅", failed: "❌", budget_exceeded: "💰",
  };
  return icons[status] || "🐜";
}

export function casteIcon(caste: string): string {
  return caste === "scout" ? "🔍" : caste === "soldier" ? "🛡️" : caste === "drone" ? "⚙️" : "⚒️";
}

export function buildReport(state: ColonyState): string {
  const m = state.metrics;
  const elapsed = state.finishedAt ? formatDuration(state.finishedAt - state.createdAt) : "?";
  return [
    `## 🐜 Ant Colony Report`,
    `**Goal:** ${state.goal}`,
    `**Status:** ${statusIcon(state.status)} ${state.status} │ ${formatCost(m.totalCost)}`,
    `**Duration:** ${elapsed}`,
    `**Tasks:** ${m.tasksDone}/${m.tasksTotal} done${m.tasksFailed > 0 ? `, ${m.tasksFailed} failed` : ""}`,
    ``,
    ...state.tasks.filter(t => t.status === "done").map(t =>
      `- ✓ **${t.title}**`
    ),
    ...state.tasks.filter(t => t.status === "failed").map(t =>
      `- ✗ **${t.title}** — ${t.error?.slice(0, 80) || "unknown"}`
    ),
  ].join("\n");
}
