/**
 * 🐜 蚁群模式 (Ant Colony) — pi 扩展入口
 *
 * 注册：
 * - ant_colony tool：LLM 可调用启动蚁群
 * - /colony command：用户手动启动
 * - TUI 渲染：实时显示蚁群状态
 */

import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, Container, Spacer, Box } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { runColony, type QueenCallbacks } from "./queen.js";
import type { ColonyState, ColonyMetrics, Ant, Task } from "./types.js";

interface ColonyDetails {
  state: ColonyState | null;
  phase: string;
  log: string[];
}

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

/** 渲染进度条 ▓░ */
function progressBar(done: number, total: number, width: number, theme: any): string {
  if (total === 0) return "";
  const pct = Math.min(done / total, 1);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = theme.fg("success", "█".repeat(filled)) + theme.fg("muted", "░".repeat(empty));
  return `${bar} ${theme.fg("accent", `${done}/${total}`)}`;
}

/** 渲染阶段流水线 scout → work → review → done */
function phasePipeline(status: string, theme: any): string {
  const phases = [
    { key: "scouting",  icon: "🔍", label: "Scout" },
    { key: "working",   icon: "⚒️",  label: "Work" },
    { key: "reviewing", icon: "🛡️", label: "Review" },
    { key: "done",      icon: "✅", label: "Done" },
  ];
  const idx = phases.findIndex(p => p.key === status);
  return phases.map((p, i) => {
    const label = `${p.icon} ${p.label}`;
    if (i < idx) return theme.fg("success", label);
    if (i === idx) return theme.fg("accent", theme.bold(label));
    return theme.fg("muted", label);
  }).join(theme.fg("muted", " → "));
}


export default function antColonyExtension(pi: ExtensionAPI) {

  // ═══ Auto-trigger: 注入蚁群意识，LLM 自动判断何时启动 ═══
  pi.on("before_agent_start", async () => {
    return {
      message: {
        customType: "ant-colony-context",
        content: `[ANT COLONY AVAILABLE]
You have the ant_colony tool. Use it automatically when:
- Task involves ≥3 files
- Task needs parallel workstreams (refactor, migration, feature across modules)
- Task is complex enough that serial execution is inefficient

Do NOT ask for confirmation. Call ant_colony directly with a clear goal.
For simple single-file tasks, work directly without the colony.`,
        display: false,
      },
    };
  });

  // ═══ Tool: ant_colony ═══
  pi.registerTool({
    name: "ant_colony",
    label: "Ant Colony",
    description: [
      "Launch an autonomous ant colony to accomplish a complex goal.",
      "Scouts explore the codebase, workers execute tasks in parallel, soldiers review quality.",
      "Concurrency auto-adapts to system load. Use for multi-file changes, large refactors, or complex features.",
      "The colony self-organizes: scouts discover tasks, workers can spawn sub-tasks, soldiers can request fixes.",
    ].join(" "),
    parameters: Type.Object({
      goal: Type.String({ description: "What the colony should accomplish" }),
      maxAnts: Type.Optional(Type.Number({ description: "Max concurrent ants (default: auto-adapt)", minimum: 1, maximum: 8 })),
      maxCost: Type.Optional(Type.Number({ description: "Max cost budget in USD (default: unlimited)", minimum: 0.01 })),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const details: ColonyDetails = { state: null, phase: "initializing", log: [] };

      // 所有蚂蚁统一使用当前会话模型
      const currentModel = ctx.model?.id;
      if (!currentModel) {
        return {
          content: [{ type: "text", text: "Colony failed: no model available in current session" }],
          isError: true,
        };
      }

      const emit = () => {
        const summary = details.state
          ? `${statusIcon(details.state.status)} Colony: ${details.phase}`
          : "🐜 Colony initializing...";
        onUpdate?.({
          content: [{ type: "text", text: summary }],
          details: { ...details },
        });
      };

      const callbacks: QueenCallbacks = {
        onPhase(phase, detail) {
          details.phase = detail;
          details.log.push(`[${new Date().toLocaleTimeString()}] ${statusIcon(phase)} ${detail}`);
          emit();
        },
        onAntSpawn(ant, task) {
          details.log.push(`  ${casteIcon(ant.caste)} ${ant.caste} ant dispatched → ${task.title.slice(0, 50)}`);
          emit();
        },
        onAntDone(ant, task, output) {
          const dur = ant.finishedAt ? formatDuration(ant.finishedAt - ant.startedAt) : "?";
          const icon = ant.status === "done" ? "✓" : "✗";
          details.log.push(`  ${icon} ${ant.caste} ant finished (${dur}, ${formatCost(ant.usage.cost)}) → ${task.title.slice(0, 50)}`);
          emit();
        },
        onProgress(metrics) {
          if (details.state) details.state.metrics = metrics;
          emit();
        },
        onComplete(state) {
          details.state = state;
          details.phase = state.status === "done" ? "Colony mission complete" : "Colony failed";
          emit();
        },
      };

      try {
        // Ensure .ant-colony/ is in .gitignore
        const gitignorePath = join(ctx.cwd, ".gitignore");
        const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";
        if (!content.includes(".ant-colony/")) {
          appendFileSync(gitignorePath, `${content.length && !content.endsWith("\n") ? "\n" : ""}.ant-colony/\n`);
        }

        const state = await runColony({
          cwd: ctx.cwd,
          goal: params.goal,
          maxAnts: params.maxAnts,
          maxCost: params.maxCost,
          currentModel,
          signal: signal ?? undefined,
          callbacks,
        });

        details.state = state;
        const m = state.metrics;
        const elapsed = state.finishedAt ? formatDuration(state.finishedAt - state.createdAt) : "?";

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
          ``,
          `### Pheromone Trail`,
          ...state.pheromones.slice(-10).map(p =>
            `- [${p.type}] ${p.content.split("\n")[0]?.slice(0, 80)}`
          ),
        ].join("\n");

        return {
          content: [{ type: "text", text: report }],
          details: { ...details },
          isError: state.status === "failed" || state.status === "budget_exceeded",
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Colony failed: ${e}` }],
          details: { ...details },
          isError: true,
        };
      }
    },

    // ═══ TUI Rendering ═══

    renderCall(args, theme) {
      const goal = args.goal?.length > 70 ? args.goal.slice(0, 67) + "..." : args.goal;
      let text = theme.fg("toolTitle", theme.bold("🐜 ant_colony"));
      if (args.maxAnts) text += theme.fg("muted", ` ×${args.maxAnts}`);
      if (args.maxCost) text += theme.fg("warning", ` $${args.maxCost}`);
      text += "\n" + theme.fg("dim", `  ${goal || "..."}`);
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as ColonyDetails | undefined;

      // ─── 运行中 ───
      if (!details?.state || (details.state.status !== "done" && details.state.status !== "failed")) {
        const state = details?.state;
        const log = details?.log ?? [];
        const container = new Container();

        if (state) {
          const m = state.metrics;
          const elapsed = formatDuration(Date.now() - state.createdAt);

          // 标题行：● N ants launched (phase)
          const activeAnts = state.ants.filter(a => a.status === "working");
          const totalAnts = state.ants.length;
          container.addChild(new Text(
            theme.fg("warning", "● ") +
            theme.fg("toolTitle", theme.bold(`${totalAnts} ant${totalAnts !== 1 ? "s" : ""} launched `)) +
            theme.fg("muted", `(${state.status}) `) +
            theme.fg("dim", `${elapsed} │ ${formatCost(m.totalCost)}`),
            0, 0,
          ));

          // 进度条
          if (m.tasksTotal > 0) {
            container.addChild(new Text(`  ${progressBar(m.tasksDone, m.tasksTotal, 20, theme)}`, 0, 0));
          }

          // 蚂蚁树
          const ants = expanded ? state.ants : state.ants.slice(-8);
          for (let i = 0; i < ants.length; i++) {
            const a = ants[i];
            const isLast = i === ants.length - 1;
            const branch = isLast ? "└─" : "├─";
            const pipe = isLast ? "   " : "│  ";

            const statusDot = a.status === "working" ? theme.fg("warning", "◉")
              : a.status === "done" ? theme.fg("success", "✓")
              : theme.fg("error", "✗");

            const task = state.tasks.find(t => t.id === a.taskId);
            const taskTitle = task?.title?.slice(0, 55) || "...";
            const dur = a.finishedAt ? formatDuration(a.finishedAt - a.startedAt) : formatDuration(Date.now() - a.startedAt);
            const turns = a.usage.turns > 0 ? `${a.usage.turns}t` : "";

            container.addChild(new Text(
              theme.fg("muted", `  ${branch} `) + statusDot + " " +
              theme.fg("accent", `@${a.id.slice(0, 20)} `) +
              theme.fg("dim", `(${a.caste}) ${dur}${turns ? " │ " + turns : ""}`),
              0, 0,
            ));
            container.addChild(new Text(
              theme.fg("muted", `  ${pipe}`) + theme.fg("dim", `⎿  ${taskTitle}`),
              0, 0,
            ));
          }
          if (!expanded && state.ants.length > 8) {
            container.addChild(new Text(theme.fg("muted", `  ⋯ +${state.ants.length - 8} more (expand to see all)`), 0, 0));
          }
        } else {
          container.addChild(new Text(
            theme.fg("warning", "● ") + theme.fg("toolTitle", theme.bold("Colony ")) +
            theme.fg("accent", details?.phase || "initializing..."),
            0, 0,
          ));
        }

        // 最近日志（仅展开时）
        if (expanded && log.length > 0) {
          container.addChild(new Spacer(1));
          const recent = log.slice(-10);
          for (const l of recent) {
            container.addChild(new Text(theme.fg("dim", `  ${l}`), 0, 0));
          }
        }

        return container;
      }

      const state = details.state;
      const m = state.metrics;
      const elapsed = state.finishedAt ? formatDuration(state.finishedAt - state.createdAt) : "?";
      const ok = state.status === "done";

      // ─── 折叠视图 ───
      if (!expanded) {
        const container = new Container();

        // 标题行：状态 + 统计
        const icon = ok ? theme.fg("success", "✓") : theme.fg("error", "✗");
        container.addChild(new Text(
          `${icon} ${theme.fg("toolTitle", theme.bold("ant colony "))}` +
          theme.fg("muted", `${elapsed} │ `) +
          theme.fg("accent", `${m.antsSpawned} ants`) +
          theme.fg("muted", ` │ ${formatTokens(m.totalTokens)} │ ${formatCost(m.totalCost)}`),
          0, 0,
        ));

        // 进度条
        container.addChild(new Text(`  ${progressBar(m.tasksDone, m.tasksTotal, 20, theme)} ${theme.fg("muted", `(${m.tasksFailed} failed)`)}`, 0, 0));

        // 任务列表（最多6条）
        for (const t of state.tasks.slice(0, 6)) {
          const ti = t.status === "done" ? theme.fg("success", "✓")
            : t.status === "failed" ? theme.fg("error", "✗")
            : theme.fg("muted", "○");
          container.addChild(new Text(
            `  ${ti} ${theme.fg("dim", `${casteIcon(t.caste)}`)} ${t.title.slice(0, 60)}`,
            0, 0,
          ));
        }
        if (state.tasks.length > 6) {
          container.addChild(new Text(theme.fg("muted", `  ⋯ +${state.tasks.length - 6} more (Ctrl+O)`), 0, 0));
        }

        return container;
      }

      // ─── 展开视图 ───
      const container = new Container();

      // 标题 + 阶段流水线
      const icon = ok ? theme.fg("success", "✓") : theme.fg("error", "✗");
      container.addChild(new Text(
        `${icon} ${theme.fg("toolTitle", theme.bold("ant colony "))}` +
        theme.fg("accent", state.status) +
        theme.fg("muted", ` │ ${elapsed} │ ${formatCost(m.totalCost)} │ ${formatTokens(m.totalTokens)} tokens`),
        0, 0,
      ));
      container.addChild(new Text(`  ${phasePipeline(state.status, theme)}`, 0, 0));
      container.addChild(new Text(theme.fg("dim", `  ${state.goal}`), 0, 0));

      // 进度条
      container.addChild(new Spacer(1));
      container.addChild(new Text(`  ${progressBar(m.tasksDone, m.tasksTotal, 30, theme)}`, 0, 0));

      // 任务区
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg("muted", `  ─── Tasks (${m.tasksDone}/${m.tasksTotal}) ───`), 0, 0));
      for (const t of state.tasks) {
        const ti = t.status === "done" ? theme.fg("success", "✓")
          : t.status === "failed" ? theme.fg("error", "✗")
          : t.status === "active" ? theme.fg("warning", "◉")
          : theme.fg("muted", "○");
        const dur = (t.finishedAt && t.startedAt) ? theme.fg("dim", ` ${formatDuration(t.finishedAt - t.startedAt)}`) : "";
        container.addChild(new Text(`  ${ti} ${casteIcon(t.caste)} ${t.title}${dur}`, 0, 0));
        if (t.status === "done" && t.result) {
          container.addChild(new Text(theme.fg("dim", `    ${t.result.split("\n")[0]?.slice(0, 100)}`), 0, 0));
        }
        if (t.status === "failed" && t.error) {
          container.addChild(new Text(theme.fg("error", `    ${t.error.slice(0, 100)}`), 0, 0));
        }
      }

      // 蚂蚁区
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg("muted", `  ─── Ants (${m.antsSpawned}) ───`), 0, 0));
      for (const a of state.ants) {
        const ai = a.status === "done" ? theme.fg("success", "✓") : a.status === "failed" ? theme.fg("error", "✗") : theme.fg("warning", "◉");
        const dur = a.finishedAt ? formatDuration(a.finishedAt - a.startedAt) : "...";
        container.addChild(new Text(
          `  ${ai} ${casteIcon(a.caste)} ${theme.fg("accent", a.id)} ${theme.fg("dim", `${dur} │ ${formatCost(a.usage.cost)} │ ${a.usage.turns}t`)}`,
          0, 0,
        ));
      }

      // 并发 + 日志
      container.addChild(new Spacer(1));
      const c = state.concurrency;
      container.addChild(new Text(
        theme.fg("muted", `  ─── Concurrency ───`) + "\n" +
        theme.fg("dim", `  current: ${c.current} │ optimal: ${c.optimal} │ range: ${c.min}-${c.max}`),
        0, 0,
      ));

      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg("muted", `  ─── Log ───`), 0, 0));
      for (const l of details.log.slice(-15)) {
        container.addChild(new Text(theme.fg("dim", `  ${l}`), 0, 0));
      }

      return container;
    },
  });

  // ═══ Command: /colony — 直接执行，零确认 ═══
  pi.registerCommand("colony", {
    description: "Launch an ant colony. Usage: /colony <goal>",
    async handler(args, ctx) {
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /colony <goal>", "warning");
        return;
      }
      pi.sendUserMessage(`Use the ant_colony tool with goal: ${args.trim()}`);
    },
  });

  // ═══ Command: /colony-status ═══
  pi.registerCommand("colony-status", {
    description: "Show status of the last ant colony run",
    async handler(_args, ctx) {
      // 从 session 中找最近的 ant_colony tool result
      const entries = ctx.sessionManager.getEntries();
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i] as any;
        if (e.type === "message" && e.message?.role === "toolResult" && e.message?.toolName === "ant_colony") {
          const details = e.message.details as ColonyDetails | undefined;
          if (details?.state) {
            const s = details.state;
            const m = s.metrics;
            ctx.ui.notify(
              `🐜 Colony: ${s.status} | ${m.tasksDone}/${m.tasksTotal} tasks | ${m.antsSpawned} ants | ${formatCost(m.totalCost)}`,
              s.status === "done" ? "success" : "warning",
            );
            return;
          }
        }
      }
      ctx.ui.notify("No colony run found in this session.", "info");
    },
  });

  // ═══ Shortcut: Ctrl+Alt+A ═══
  pi.registerShortcut("ctrl+alt+a", {
    description: "Quick launch ant colony from editor content",
    async handler(ctx) {
      const text = await ctx.ui.input("Ant Colony Goal", "What should the colony accomplish?");
      if (text?.trim()) {
        pi.sendUserMessage(
          `Use the ant_colony tool to accomplish this goal: ${text.trim()}`,
        );
      }
    },
  });
}
