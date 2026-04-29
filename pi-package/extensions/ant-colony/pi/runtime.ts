import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { runColony, resumeColony, type QueenCallbacks } from "../core/queen.js";
import type { ColonyState, AntStreamEvent } from "../core/types.js";
import { createDefaultPiAdapter } from "./adapter.js";
import { buildReport, formatCost, statusLabel } from "../core/ui.js";
import { ensureGitignore, pushLog, type BackgroundColony } from "./ui.js";

export interface ColonyLaunchParams {
  goal: string;
  maxAnts?: number;
  maxCost?: number;
  currentModel: string;
  modelOverrides: Record<string, string>;
  cwd: string;
  modelRegistry?: any;
}

export async function runSyncColony(
  params: ColonyLaunchParams,
  signal?: AbortSignal | null,
) {
  ensureGitignore(params.cwd);

  const callbacks: QueenCallbacks = {};

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
      piAdapter: createDefaultPiAdapter({ modelRegistry: params.modelRegistry }),
    });

    return {
      content: [{ type: "text" as const, text: buildReport(state) }],
      isError: state.status === "failed" || state.status === "budget_exceeded",
    };
  } catch (e) {
    return {
      content: [{ type: "text" as const, text: `Colony failed: ${e}` }],
      isError: true,
    };
  }
}

export interface LaunchBackgroundColonyDeps {
  pi: ExtensionAPI;
  activeColony: BackgroundColony | null;
  setActiveColony(colony: BackgroundColony | null): void;
  resetStatusSnapshotCooldown(): void;
  throttledRender(): void;
}

export function launchBackgroundColony(
  params: ColonyLaunchParams,
  deps: LaunchBackgroundColonyDeps,
  resume = false,
) {
  const { pi } = deps;
  if (deps.activeColony) {
    pi.events.emit("ant-colony:notify", { msg: "A colony is already running. Use /colony-stop first.", level: "warning" });
    return;
  }

  const abortController = new AbortController();
  const colony: BackgroundColony = {
    goal: params.goal,
    abortController,
    state: null,
    phase: "initializing",
    antStreams: new Map(),
    logs: [],
    promise: null as any,
  };

  pushLog(colony, { level: "info", text: "INITIALIZING · Colony launched in background" });

  let lastPhase = "";
  const callbacks: QueenCallbacks = {
    onSignal(signal) {
      colony.phase = signal.message;
      if (signal.phase !== lastPhase) {
        lastPhase = signal.phase;
        const pct = Math.round(signal.progress * 100);
        pushLog(colony, { level: "info", text: `${statusLabel(signal.phase)} ${pct}% · ${signal.message}` });
        pi.sendMessage({
          customType: "ant-colony-progress",
          content: `[COLONY_SIGNAL:${signal.phase.toUpperCase()}] 🐜 ${signal.message} (${pct}%, ${formatCost(signal.cost)})`,
          display: true,
        }, { triggerTurn: false, deliverAs: "followUp" });
      }
      deps.throttledRender();
    },
    onPhase(phase, detail) {
      colony.phase = detail;
      pushLog(colony, { level: "info", text: `${statusLabel(phase)} · ${detail}` });
      deps.throttledRender();
    },
    onAntSpawn(ant) {
      colony.antStreams.set(ant.id, { antId: ant.id, caste: ant.caste, lastLine: "starting...", tokens: 0 });
      deps.throttledRender();
    },
    onAntDone(ant, task) {
      colony.antStreams.delete(ant.id);
      const m = colony.state?.metrics;
      const icon = ant.status === "done" ? "✓" : "✗";
      const progress = m ? `${m.tasksDone}/${m.tasksTotal}` : "";
      const cost = m ? formatCost(m.totalCost) : "";
      pushLog(colony, {
        level: ant.status === "done" ? "info" : "warning",
        text: `${icon} ${task.title.slice(0, 80)} (${progress}${cost ? `, ${cost}` : ""})`,
      });
      pi.sendMessage({
        customType: "ant-colony-progress",
        content: `[COLONY_SIGNAL:TASK_DONE] 🐜 ${icon} ${task.title.slice(0, 60)} (${progress}, ${cost})`,
        display: true,
      }, { triggerTurn: false, deliverAs: "followUp" });
      deps.throttledRender();
    },
    onAntStream(event: AntStreamEvent) {
      const stream = colony.antStreams.get(event.antId);
      if (stream) {
        stream.tokens++;
        const lines = event.totalText.split("\n").filter(l => l.trim());
        stream.lastLine = lines[lines.length - 1]?.trim() || "...";
      }
    },
    onProgress(metrics) {
      if (colony.state) colony.state.metrics = metrics;
      deps.throttledRender();
    },
    onComplete(state) {
      colony.state = state;
      colony.phase = state.status === "done" ? "Colony mission complete" : "Colony failed";
      pushLog(colony, {
        level: state.status === "done" ? "info" : "error",
        text: `${statusLabel(state.status)} · ${state.metrics.tasksDone}/${state.metrics.tasksTotal} · ${formatCost(state.metrics.totalCost)}`,
      });
      colony.antStreams.clear();
      deps.throttledRender();
    },
  };

  ensureGitignore(params.cwd);

  const colonyOpts = {
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
    piAdapter: createDefaultPiAdapter({ modelRegistry: params.modelRegistry }),
  };
  colony.promise = resume ? resumeColony(colonyOpts) : runColony(colonyOpts);

  deps.setActiveColony(colony);
  deps.resetStatusSnapshotCooldown();
  deps.throttledRender();

  colony.promise.then((state: ColonyState) => {
    const ok = state.status === "done";
    const report = buildReport(state);
    const m = state.metrics;
    pushLog(colony, {
      level: ok ? "info" : "error",
      text: `${ok ? "COMPLETE" : "FAILED"} · ${m.tasksDone}/${m.tasksTotal} · ${formatCost(m.totalCost)}`,
    });

    pi.events.emit("ant-colony:clear-ui");
    deps.setActiveColony(null);

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
    pushLog(colony, { level: "error", text: `CRASHED · ${String(e).slice(0, 120)}` });
    pi.events.emit("ant-colony:clear-ui");
    deps.setActiveColony(null);
    pi.events.emit("ant-colony:notify", { msg: `🐜 Colony crashed: ${e}`, level: "error" });
    pi.sendMessage({
      customType: "ant-colony-report",
      content: `[COLONY_SIGNAL:FAILED]\n## 🐜 Colony Crashed\n${e}`,
      display: true,
    }, { triggerTurn: true, deliverAs: "followUp" });
  });
}
