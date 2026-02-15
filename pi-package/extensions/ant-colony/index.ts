/**
 * 🐜 蚁群模式 (Ant Colony) — pi 扩展入口
 *
 * 方案二：后台非阻塞蚁群
 * - 蚁群在后台运行，不阻塞主对话
 * - ctx.ui.setWidget() 实时蚂蚁面板
 * - ctx.ui.setStatus() footer 进度
 * - 完成后 pi.sendMessage() 注入报告
 * - /colony-stop 取消运行中的蚁群
 */

import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, Container, Spacer, matchesKey } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { runColony, type QueenCallbacks } from "./queen.js";
import type { ColonyState, ColonyMetrics, AntStreamEvent } from "./types.js";

// ═══ Helpers ═══

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  return n < 1000 ? `${n}` : n < 1000000 ? `${(n / 1000).toFixed(1)}k` : `${(n / 1000000).toFixed(1)}M`;
}

function statusIcon(status: string): string {
  const icons: Record<string, string> = {
    scouting: "🔍", working: "⚒️", reviewing: "🛡️",
    done: "✅", failed: "❌", budget_exceeded: "💰",
  };
  return icons[status] || "🐜";
}

function casteIcon(caste: string): string {
  return caste === "scout" ? "🔍" : caste === "soldier" ? "🛡️" : "⚒️";
}

// ═══ Background colony state ═══

interface AntStreamState {
  antId: string;
  caste: string;
  lastLine: string;
  tokens: number;
}

interface BackgroundColony {
  goal: string;
  abortController: AbortController;
  state: ColonyState | null;
  phase: string;
  log: string[];
  antStreams: Map<string, AntStreamState>;
  promise: Promise<ColonyState>;
}

export default function antColonyExtension(pi: ExtensionAPI) {

  // 当前运行中的后台蚁群（同时只允许一个）
  let activeColony: BackgroundColony | null = null;

  // ─── Status 渲染 ───

  let lastRender = 0;
  const throttledRender = () => {
    const now = Date.now();
    if (now - lastRender < 500) return;
    lastRender = now;
    pi.events.emit("ant-colony:render");
  };

  // 监听事件来更新 UI（确保在有 ctx 的上下文中）
  pi.on("session_start", async (_event, ctx) => {
    pi.events.on("ant-colony:render", () => {
      if (!activeColony) return;
      const { state, antStreams } = activeColony;
      const active = antStreams.size;
      const elapsed = state ? formatDuration(Date.now() - state.createdAt) : "0s";
      const m = state?.metrics;
      const colonyStatus = state?.status || "scouting";
      const ants = state?.ants || [];
      const turns = ants.reduce((s, a) => s + a.usage.turns, 0);
      const outTok = ants.reduce((s, a) => s + a.usage.output, 0);

      const parts = [`🐜 ${statusIcon(colonyStatus)}`];
      if (m) parts.push(`${m.tasksDone}/${m.tasksTotal}`);
      parts.push(`${active}⚡`);
      parts.push(`${turns}↻`);
      parts.push(formatTokens(outTok) + "↑");
      if (m) parts.push(formatCost(m.totalCost));
      parts.push(elapsed);

      ctx.ui.setStatus("ant-colony", parts.join(" │ "));
    });

    pi.events.on("ant-colony:clear-ui", () => {
      ctx.ui.setStatus("ant-colony", undefined);
    });
    pi.events.on("ant-colony:notify", (data: { msg: string; level: "info" | "success" | "warning" | "error" }) => {
      ctx.ui.notify(data.msg, data.level);
    });
  });

  // ─── 同步模式（print mode）：阻塞等待蚁群完成 ───

  async function runSyncColony(params: {
    goal: string;
    maxAnts?: number;
    maxCost?: number;
    currentModel: string;
    modelOverrides: Record<string, string>;
    cwd: string;
    modelRegistry?: any;
  }, signal?: AbortSignal | null) {
    const gitignorePath = join(params.cwd, ".gitignore");
    const gitContent = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";
    if (!gitContent.includes(".ant-colony/")) {
      appendFileSync(gitignorePath, `${gitContent.length && !gitContent.endsWith("\n") ? "\n" : ""}.ant-colony/\n`);
    }

    const log: string[] = [];
    const callbacks: QueenCallbacks = {
      onPhase(_phase, detail) { log.push(detail); },
      onAntSpawn(ant, task) { log.push(`  ${casteIcon(ant.caste)} ${ant.caste} → ${task.title.slice(0, 50)}`); },
      onAntDone(ant, task) {
        const dur = ant.finishedAt ? formatDuration(ant.finishedAt - ant.startedAt) : "?";
        log.push(`  ${ant.status === "done" ? "✓" : "✗"} ${ant.caste} (${dur}) → ${task.title.slice(0, 50)}`);
      },
      onAntStream() {},
      onProgress() {},
      onComplete() {},
    };

    try {
      const state = await runColony({
        cwd: params.cwd,
        goal: params.goal,
        maxAnts: params.maxAnts,
        maxCost: params.maxCost,
        currentModel: params.currentModel,
        modelOverrides: params.modelOverrides,
        signal: signal ?? undefined,
        callbacks,
        modelRegistry: params.modelRegistry,
      });

      const m = state.metrics;
      const elapsed = state.finishedAt ? formatDuration(state.finishedAt - state.createdAt) : "?";
      const report = [
        `## 🐜 Ant Colony Report`,
        `**Goal:** ${state.goal}`,
        `**Status:** ${statusIcon(state.status)} ${state.status} │ ${elapsed}`,
        `**Metrics:** ${m.tasksDone}/${m.tasksTotal} tasks │ ${m.antsSpawned} ants │ ${formatTokens(m.totalTokens)} │ ${formatCost(m.totalCost)}`,
        ``,
        ...state.tasks.filter(t => t.status === "done").map(t =>
          `- ✓ **${t.title}**${t.result ? `: ${t.result.split("\n")[0]?.slice(0, 100)}` : ""}`
        ),
        ...state.tasks.filter(t => t.status === "failed").map(t =>
          `- ✗ **${t.title}** — ${t.error?.slice(0, 100) || "unknown"}`
        ),
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: report }],
        isError: state.status === "failed" || state.status === "budget_exceeded",
      };
    } catch (e) {
      return {
        content: [{ type: "text" as const, text: `Colony failed: ${e}` }],
        isError: true,
      };
    }
  }

  // ─── 启动后台蚁群 ───

  function launchBackgroundColony(params: {
    goal: string;
    maxAnts?: number;
    maxCost?: number;
    currentModel: string;
    modelOverrides: Record<string, string>;
    cwd: string;
    modelRegistry?: any;
  }) {
    if (activeColony) {
      pi.events.emit("ant-colony:notify", { msg: "A colony is already running. Use /colony-stop first.", level: "warning" });
      return;
    }

    const abortController = new AbortController();
    const colony: BackgroundColony = {
      goal: params.goal,
      abortController,
      state: null,
      phase: "initializing",
      log: [],
      antStreams: new Map(),
      promise: null as any, // set below
    };

    const callbacks: QueenCallbacks = {
      onPhase(phase, detail) {
        colony.phase = detail;
        colony.log.push(`[${new Date().toLocaleTimeString()}] ${statusIcon(phase)} ${detail}`);
        throttledRender();
      },
      onAntSpawn(ant, task) {
        colony.antStreams.set(ant.id, {
          antId: ant.id,
          caste: ant.caste,
          lastLine: "starting...",
          tokens: 0,
        });
        colony.log.push(`  ${casteIcon(ant.caste)} ${ant.caste} ant dispatched → ${task.title.slice(0, 50)}`);
        throttledRender();
      },
      onAntDone(ant, task) {
        colony.antStreams.delete(ant.id);
        const dur = ant.finishedAt ? formatDuration(ant.finishedAt - ant.startedAt) : "?";
        const icon = ant.status === "done" ? "✓" : "✗";
        colony.log.push(`  ${icon} ${ant.caste} finished (${dur}, ${formatCost(ant.usage.cost)}) → ${task.title.slice(0, 50)}`);
        throttledRender();
      },
      onAntStream(event: AntStreamEvent) {
        const stream = colony.antStreams.get(event.antId);
        if (stream) {
          stream.tokens++;
          const lines = event.totalText.split("\n").filter(l => l.trim());
          stream.lastLine = lines[lines.length - 1]?.trim() || "...";
        }
        throttledRender();
      },
      onProgress(metrics) {
        if (colony.state) colony.state.metrics = metrics;
        throttledRender();
      },
      onComplete(state) {
        colony.state = state;
        colony.phase = state.status === "done" ? "Colony mission complete" : "Colony failed";
        colony.antStreams.clear();
        throttledRender();
      },
    };

    // Ensure .ant-colony/ is in .gitignore
    const gitignorePath = join(params.cwd, ".gitignore");
    const gitContent = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";
    if (!gitContent.includes(".ant-colony/")) {
      appendFileSync(gitignorePath, `${gitContent.length && !gitContent.endsWith("\n") ? "\n" : ""}.ant-colony/\n`);
    }

    colony.promise = runColony({
      cwd: params.cwd,
      goal: params.goal,
      maxAnts: params.maxAnts,
      maxCost: params.maxCost,
      currentModel: params.currentModel,
      modelOverrides: params.modelOverrides,
      signal: abortController.signal,
      callbacks,
      authStorage: undefined,
      modelRegistry: params.modelRegistry,
    });

    activeColony = colony;
    throttledRender();

    // 后台等待完成，注入结果
    colony.promise.then((state) => {
      const m = state.metrics;
      const elapsed = state.finishedAt ? formatDuration(state.finishedAt - state.createdAt) : "?";
      const ok = state.status === "done";

      const report = [
        `## 🐜 Ant Colony Report`,
        ``,
        `**Goal:** ${state.goal}`,
        `**Status:** ${statusIcon(state.status)} ${state.status}`,
        `**Duration:** ${elapsed}`,
        ...(state.maxCost != null ? [`**Budget:** ${formatCost(m.totalCost)} / ${formatCost(state.maxCost)}`] : []),
        ``,
        `### Metrics`,
        `- Tasks: ${m.tasksDone}/${m.tasksTotal} done, ${m.tasksFailed} failed`,
        `- Ants spawned: ${m.antsSpawned}`,
        `- Tokens: ${formatTokens(m.totalTokens)}`,
        `- Cost: ${formatCost(m.totalCost)}`,
        `- Peak concurrency: ${state.concurrency.optimal}`,
        ``,
        `### Task Results`,
        ...state.tasks.filter(t => t.status === "done").map(t =>
          `- ✓ **${t.title}** (${t.caste})${t.result ? `\n  ${t.result.split("\n")[0]?.slice(0, 100)}` : ""}`
        ),
        ...state.tasks.filter(t => t.status === "failed").map(t =>
          `- ✗ **${t.title}** — ${t.error?.slice(0, 100) || "unknown error"}`
        ),
      ].join("\n");

      // 清理 UI
      pi.events.emit("ant-colony:clear-ui");
      activeColony = null;

      // 注入结果到对话
      pi.sendMessage({
        customType: "ant-colony-report",
        content: `[COLONY_SIGNAL:COMPLETE]\n${report}`,
        display: true,
      }, { triggerTurn: true, deliverAs: "followUp" });

      pi.events.emit("ant-colony:notify", {
        msg: `🐜 Colony ${ok ? "completed" : "failed"}: ${m.tasksDone}/${m.tasksTotal} tasks │ ${formatCost(m.totalCost)}`,
        level: ok ? "success" : "error",
      });
    }).catch((e) => {
      pi.events.emit("ant-colony:clear-ui");
      activeColony = null;
      pi.events.emit("ant-colony:notify", { msg: `🐜 Colony crashed: ${e}`, level: "error" });
      pi.sendMessage({
        customType: "ant-colony-report",
        content: `[COLONY_SIGNAL:FAILED]\n## 🐜 Colony Crashed\n${e}`,
        display: true,
      }, { triggerTurn: true, deliverAs: "followUp" });
    });
  }

  // ═══ Auto-trigger: 注入蚁群意识 ═══
  pi.on("before_agent_start", async () => {
    let modelList = "";
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync("pi --list-models 2>/dev/null", { encoding: "utf-8", timeout: 5000 });
      const models = output.trim().split("\n").slice(1)
        .map(l => l.trim().split(/\s+/))
        .filter(p => p.length >= 2)
        .map(p => `${p[0]}/${p[1]}`);
      if (models.length > 0) modelList = models.join(", ");
    } catch { /* ignore */ }

    const colonyStatus = activeColony
      ? `\n[COLONY_SIGNAL:RUNNING] A colony is currently running in the background for goal: "${activeColony.goal.slice(0, 100)}". Do NOT launch another colony. Do NOT check progress or assume failure. You will receive [COLONY_SIGNAL:COMPLETE] automatically when it finishes. If the user asks about colony status, tell them it's still running. Use /colony-stop to cancel.`
      : "";

    return {
      message: {
        customType: "ant-colony-context",
        content: `[ANT COLONY AVAILABLE]
You have the ant_colony tool. Use it automatically when:
- Task involves ≥3 files
- Task needs parallel workstreams (refactor, migration, feature across modules)
- Task is complex enough that serial execution is inefficient

Do NOT ask for confirmation. Call ant_colony directly with a clear goal.
For simple single-file tasks, work directly without the colony.

[COLONY SIGNAL PROTOCOL]
The colony communicates via signals. You MUST obey these:
- [COLONY_SIGNAL:LAUNCHED] — Colony started. Do NOT poll, check, or assume failure. Wait for completion signal.
- [COLONY_SIGNAL:RUNNING] — Colony is active. Do NOT launch another or check progress.
- [COLONY_SIGNAL:COMPLETE] — Colony finished. Review the report and summarize results to the user.
- [COLONY_SIGNAL:FAILED] — Colony crashed. Report the error to the user.

After launching a colony, your ONLY correct behavior is:
1. Tell the user the colony is running
2. Continue chatting about OTHER topics if the user asks
3. Wait for [COLONY_SIGNAL:COMPLETE] or [COLONY_SIGNAL:FAILED] — do NOT guess the outcome
${modelList ? `
[COLONY MODEL SELECTION]
Available models: ${modelList}

Strategy for choosing per-caste models:
- scoutModel: Use a fast/cheap model (e.g. haiku, flash, gpt-4o-mini). Scouts only read, no edits.
- workerModel: Use a capable model (e.g. sonnet, opus, gpt-4o). Workers make code changes.
- soldierModel: Use same as worker or slightly cheaper. Soldiers review but don't edit.
- If unsure, omit all three — defaults to current session model.
- Prefer latest model versions for best quality.` : ""}${colonyStatus}`,
        display: false,
      },
    };
  });

  // ═══ Tool: ant_colony (non-blocking) ═══
  pi.registerTool({
    name: "ant_colony",
    label: "Ant Colony",
    description: [
      "Launch an autonomous ant colony in the BACKGROUND to accomplish a complex goal.",
      "The colony runs asynchronously — you can continue chatting while it works.",
      "Results are automatically injected when the colony finishes.",
      "Scouts explore the codebase, workers execute tasks in parallel, soldiers review quality.",
      "Use for multi-file changes, large refactors, or complex features.",
    ].join(" "),
    parameters: Type.Object({
      goal: Type.String({ description: "What the colony should accomplish" }),
      maxAnts: Type.Optional(Type.Number({ description: "Max concurrent ants (default: auto-adapt)", minimum: 1, maximum: 8 })),
      maxCost: Type.Optional(Type.Number({ description: "Max cost budget in USD (default: unlimited)", minimum: 0.01 })),
      scoutModel: Type.Optional(Type.String({ description: "Model for scout ants (default: current session model)" })),
      workerModel: Type.Optional(Type.String({ description: "Model for worker ants (default: current session model)" })),
      soldierModel: Type.Optional(Type.String({ description: "Model for soldier ants (default: current session model)" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (activeColony) {
        return {
          content: [{ type: "text", text: "A colony is already running in the background. Use /colony-stop to cancel it first." }],
          isError: true,
        };
      }

      const currentModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : null;
      if (!currentModel) {
        return {
          content: [{ type: "text", text: "Colony failed: no model available in current session" }],
          isError: true,
        };
      }

      const modelOverrides: Record<string, string> = {};
      if (params.scoutModel) modelOverrides.scout = params.scoutModel;
      if (params.workerModel) modelOverrides.worker = params.workerModel;
      if (params.soldierModel) modelOverrides.soldier = params.soldierModel;

      const colonyParams = {
        goal: params.goal,
        maxAnts: params.maxAnts,
        maxCost: params.maxCost,
        currentModel,
        modelOverrides,
        cwd: ctx.cwd,
        modelRegistry: ctx.modelRegistry ?? undefined,
      };

      // 非交互模式（print mode）：同步等待蚁群完成
      if (!ctx.hasUI) {
        return await runSyncColony(colonyParams, _signal);
      }

      // 交互模式：后台运行
      launchBackgroundColony(colonyParams);

      return {
        content: [{ type: "text", text: `[COLONY_SIGNAL:LAUNCHED]\n🐜 Colony launched in background.\nGoal: ${params.goal}\n\n⚠️ IMPORTANT: The colony is now running autonomously. Do NOT check progress, do NOT ask about status, do NOT assume failure. You will receive a [COLONY_SIGNAL:COMPLETE] message automatically when it finishes. Continue chatting about other topics or wait silently.` }],
      };
    },

    renderCall(args, theme) {
      const goal = args.goal?.length > 70 ? args.goal.slice(0, 67) + "..." : args.goal;
      let text = theme.fg("toolTitle", theme.bold("🐜 ant_colony"));
      if (args.maxAnts) text += theme.fg("muted", ` ×${args.maxAnts}`);
      if (args.maxCost) text += theme.fg("warning", ` $${args.maxCost}`);
      text += "\n" + theme.fg("dim", `  ${goal || "..."}`);
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme) {
      // 后台模式：tool result 只是启动确认
      const text = result.content?.find((c: any) => c.type === "text")?.text || "";
      if (result.isError) {
        return new Text(theme.fg("error", text), 0, 0);
      }
      const container = new Container();
      container.addChild(new Text(
        theme.fg("success", "✓ ") + theme.fg("toolTitle", theme.bold("Colony launched in background")),
        0, 0,
      ));
      if (activeColony) {
        container.addChild(new Text(theme.fg("dim", `  Goal: ${activeColony.goal.slice(0, 70)}`), 0, 0));
        container.addChild(new Text(theme.fg("muted", `  Ctrl+Shift+A for details │ /colony-stop to cancel`), 0, 0));
      }
      return container;
    },
  });

  // ═══ Custom message renderer for colony reports ═══
  pi.registerMessageRenderer("ant-colony-report", (message, theme) => {
    const content = typeof message.content === "string" ? message.content : "";
    const container = new Container();

    // 提取关键信息渲染
    const statusMatch = content.match(/\*\*Status:\*\* (.+)/);
    const durationMatch = content.match(/\*\*Duration:\*\* (.+)/);
    const ok = content.includes("✅ done");

    container.addChild(new Text(
      (ok ? theme.fg("success", "✓") : theme.fg("error", "✗")) + " " +
      theme.fg("toolTitle", theme.bold("🐜 Ant Colony Report")) +
      (durationMatch ? theme.fg("muted", ` │ ${durationMatch[1]}`) : ""),
      0, 0,
    ));

    // 渲染任务结果
    const taskLines = content.split("\n").filter(l => l.startsWith("- ✓") || l.startsWith("- ✗"));
    for (const l of taskLines.slice(0, 8)) {
      const icon = l.startsWith("- ✓") ? theme.fg("success", "✓") : theme.fg("error", "✗");
      container.addChild(new Text(`  ${icon} ${theme.fg("dim", l.slice(4).trim().slice(0, 70))}`, 0, 0));
    }
    if (taskLines.length > 8) {
      container.addChild(new Text(theme.fg("muted", `  ⋯ +${taskLines.length - 8} more`), 0, 0));
    }

    // Metrics 行
    const metricsLines = content.split("\n").filter(l => l.startsWith("- ") && !l.startsWith("- ✓") && !l.startsWith("- ✗") && !l.startsWith("- ["));
    if (metricsLines.length > 0) {
      container.addChild(new Text(theme.fg("muted", `  ${metricsLines.map(l => l.slice(2)).join(" │ ")}`), 0, 0));
    }

    return container;
  });

  // ═══ Shortcut: Ctrl+Shift+A 展开蚁群详情 ═══
  pi.registerShortcut("ctrl+shift+a", {
    description: "Show ant colony details",
    async handler(ctx) {
      if (!activeColony) {
        ctx.ui.notify("No colony is currently running.", "info");
        return;
      }

      await ctx.ui.custom<void>((tui, theme, _kb, done) => {
        let cachedWidth: number | undefined;
        let cachedLines: string[] | undefined;

        const buildLines = (width: number): string[] => {
          const c = activeColony;
          if (!c) return [theme.fg("muted", "  No colony running.")];

          const lines: string[] = [];
          const w = width - 2; // padding

          // ── Header ──
          const elapsed = c.state ? formatDuration(Date.now() - c.state.createdAt) : "0s";
          const cost = c.state ? formatCost(c.state.metrics.totalCost) : "$0";
          lines.push(theme.fg("accent", theme.bold(`  🐜 Colony Details`)) + theme.fg("muted", ` │ ${elapsed} │ ${cost}`));
          lines.push(theme.fg("dim", `  Goal: ${c.goal.slice(0, w - 8)}`));
          lines.push("");

          // ── Tasks ──
          const tasks = c.state?.tasks || [];
          if (tasks.length > 0) {
            lines.push(theme.fg("accent", "  Tasks"));
            for (const t of tasks.slice(0, 15)) {
              const icon = t.status === "done" ? theme.fg("success", "✓")
                : t.status === "failed" ? theme.fg("error", "✗")
                : t.status === "active" ? theme.fg("warning", "●")
                : theme.fg("dim", "○");
              const dur = t.finishedAt && t.startedAt ? theme.fg("dim", ` ${formatDuration(t.finishedAt - t.startedAt)}`) : "";
              lines.push(`  ${icon} ${casteIcon(t.caste)} ${theme.fg("text", t.title.slice(0, w - 12))}${dur}`);
            }
            if (tasks.length > 15) lines.push(theme.fg("muted", `  ⋯ +${tasks.length - 15} more`));
            lines.push("");
          }

          // ── Active Ants ──
          const streams = Array.from(c.antStreams.values());
          if (streams.length > 0) {
            lines.push(theme.fg("accent", "  Active Ants"));
            for (const s of streams) {
              const line = s.lastLine.length > w - 20 ? s.lastLine.slice(0, w - 23) + "..." : s.lastLine;
              lines.push(`  ${casteIcon(s.caste)} ${theme.fg("accent", s.antId.slice(0, 14))} ${theme.fg("dim", `${s.tokens}tok`)} ${theme.fg("muted", "▸")} ${line}`);
            }
            lines.push("");
          }

          // ── Log (last 8) ──
          if (c.log.length > 0) {
            lines.push(theme.fg("accent", "  Log"));
            for (const l of c.log.slice(-8)) {
              lines.push(theme.fg("dim", `  ${l.slice(0, w - 2)}`));
            }
          }

          lines.push("");
          lines.push(theme.fg("muted", "  esc close"));
          return lines;
        };

        // 定时刷新
        const timer = setInterval(() => {
          cachedWidth = undefined;
          cachedLines = undefined;
          tui.requestRender();
        }, 1000);

        return {
          render(width: number): string[] {
            if (cachedLines && cachedWidth === width) return cachedLines;
            cachedLines = buildLines(width);
            cachedWidth = width;
            return cachedLines;
          },
          invalidate() { cachedWidth = undefined; cachedLines = undefined; },
          handleInput(data: string) {
            if (matchesKey(data, "escape")) {
              clearInterval(timer);
              done(undefined);
            }
          },
        };
      }, { overlay: true, overlayOptions: { anchor: "center", width: "80%", maxHeight: "80%" } });
    },
  });

  // ═══ Command: /colony-stop ═══
  pi.registerCommand("colony-stop", {
    description: "Stop the running background colony",
    async handler(_args, ctx) {
      if (!activeColony) {
        ctx.ui.notify("No colony is currently running.", "info");
        return;
      }
      activeColony.abortController.abort();
      ctx.ui.notify("🐜 Colony abort signal sent. Waiting for ants to finish...", "warning");
    },
  });

  // ═══ Cleanup on shutdown ═══
  pi.on("session_shutdown", async () => {
    if (activeColony) {
      activeColony.abortController.abort();
      activeColony = null;
    }
  });
}
