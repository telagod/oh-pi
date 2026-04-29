import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ColonyState, ColonyMetrics } from "../core/types.js";
import { formatCost, formatDuration, progressBar, statusIcon, statusLabel } from "../core/ui.js";

export function ensureGitignore(cwd: string) {
  const gitignorePath = join(cwd, ".gitignore");
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";
  if (!content.includes(".ant-colony/")) {
    appendFileSync(gitignorePath, `${content.length && !content.endsWith("\n") ? "\n" : ""}.ant-colony/\n`);
  }
}

export interface AntStreamState { antId: string; caste: string; lastLine: string; tokens: number; }
export interface ColonyLogEntry { timestamp: number; level: "info" | "warning" | "error"; text: string; }
export interface BackgroundColony {
  goal: string;
  abortController: AbortController;
  state: ColonyState | null;
  phase: string;
  antStreams: Map<string, AntStreamState>;
  logs: ColonyLogEntry[];
  promise: Promise<ColonyState>;
}

export function calcProgress(m?: ColonyMetrics | null) {
  if (!m || m.tasksTotal <= 0) return 0;
  return Math.max(0, Math.min(1, m.tasksDone / m.tasksTotal));
}

export function trim(text: string, max: number) {
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
}

export function pushLog(colony: BackgroundColony, entry: Omit<ColonyLogEntry, "timestamp">) {
  colony.logs.push({ timestamp: Date.now(), ...entry });
  if (colony.logs.length > 40) colony.logs.splice(0, colony.logs.length - 40);
}

export function buildStatusText(activeColony: BackgroundColony | null): string {
  if (!activeColony) return "No colony is currently running.";
  const c = activeColony;
  const state = c.state;
  const elapsed = state ? formatDuration(Date.now() - state.createdAt) : "0s";
  const m = state?.metrics;
  const phase = state?.status || "scouting";
  const progress = calcProgress(m);
  const pct = Math.round(progress * 100);
  const activeAnts = c.antStreams.size;
  const lines: string[] = [
    `🐜 ${statusIcon(phase)} ${trim(c.goal, 80)}`,
    `${statusLabel(phase)} │ ${m ? `${m.tasksDone}/${m.tasksTotal} tasks` : "starting"} │ ${pct}% │ ⚡${activeAnts} │ ${m ? formatCost(m.totalCost) : "$0"} │ ${elapsed}`,
    `${progressBar(progress, 18)} ${pct}%`,
  ];
  if (c.phase && c.phase !== "initializing") lines.push(`Phase: ${trim(c.phase, 100)}`);
  const lastLog = c.logs[c.logs.length - 1];
  if (lastLog) lines.push(`Last: ${trim(lastLog.text, 100)}`);
  if (m && m.tasksFailed > 0) lines.push(`⚠ ${m.tasksFailed} failed`);
  return lines.join("\n");
}
