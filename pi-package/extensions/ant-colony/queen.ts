/**
 * 蚁后 (Queen) — 蚁群调度核心
 *
 * 生命周期：
 * 1. 接收目标 → 派侦察蚁探路
 * 2. 侦察蚁返回 → 根据发现生成任务池
 * 3. 自适应派工蚁执行任务
 * 4. 任务完成 → 派兵蚁审查
 * 5. 有问题 → 生成修复任务回到步骤3
 * 6. 全部通过 → 汇总报告
 *
 * 调度循环模拟真实蚁群：蚂蚁不断出巢→觅食→回巢→再出巢
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  ColonyState, Task, Ant, AntCaste, ColonyMetrics, ColonySignal,
  ConcurrencyConfig, TaskPriority, ModelOverrides, AntStreamEvent,
} from "./types.js";
import { DEFAULT_ANT_CONFIGS } from "./types.js";
import { Nest } from "./nest.js";
import { spawnAnt, runDrone, makeTaskId } from "./spawner.js";
import { adapt, sampleSystem, defaultConcurrency } from "./concurrency.js";
import { buildImportGraph, taskDependsOn, type ImportGraph } from "./deps.js";
import type { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";

export interface QueenCallbacks {
  /** 抽象信号 — 观察者只需实现这一个 */
  onSignal?(signal: ColonySignal): void;
  /** 以下为细粒度回调（verbose 模式，可选） */
  onPhase?(phase: ColonyState["status"], detail: string): void;
  onAntSpawn?(ant: Ant, task: Task): void;
  onAntDone?(ant: Ant, task: Task, output: string): void;
  onAntStream?(event: AntStreamEvent): void;
  onProgress?(metrics: ColonyMetrics): void;
  onComplete?(state: ColonyState): void;
}

export interface QueenOptions {
  cwd: string;
  goal: string;
  maxAnts?: number;
  maxCost?: number;
  currentModel: string;
  modelOverrides?: ModelOverrides;
  signal?: AbortSignal;
  callbacks: QueenCallbacks;
  authStorage?: AuthStorage;
  modelRegistry?: ModelRegistry;
}

function makeColonyId(): string {
  return `colony-${Date.now().toString(36)}`;
}

function makeInitialScoutTask(goal: string): Task {
  return {
    id: makeTaskId(),
    parentId: null,
    title: "Scout: explore codebase for goal",
    description: `Explore the codebase and identify all files, modules, and dependencies relevant to this goal:\n\n${goal}\n\nBe thorough. The colony depends on your intelligence.`,
    caste: "scout",
    status: "pending",
    priority: 1,
    files: [],
    claimedBy: null,
    result: null,
    error: null,
    spawnedTasks: [],
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };
}

function childTaskFromParsed(
  parentId: string,
  parsed: { title: string; description: string; files: string[]; caste: AntCaste; priority: TaskPriority; context?: string },
): Task {
  return {
    id: makeTaskId(),
    parentId,
    title: parsed.title,
    description: parsed.description,
    caste: parsed.caste,
    status: "pending",
    priority: parsed.priority,
    files: parsed.files,
    context: parsed.context || undefined,
    claimedBy: null,
    result: null,
    error: null,
    spawnedTasks: [],
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };
}

function makeReviewTask(completedTasks: Task[]): Task {
  const files = [...new Set(completedTasks.flatMap(t => t.files))];
  return {
    id: makeTaskId(),
    parentId: null,
    title: "Soldier: review all changes",
    description: `Review all changes made by worker ants. Files changed:\n${files.map(f => `- ${f}`).join("\n")}`,
    caste: "soldier",
    status: "pending",
    priority: 1,
    files,
    claimedBy: null,
    result: null,
    error: null,
    spawnedTasks: [],
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };
}

function updateMetrics(nest: Nest): ColonyMetrics {
  const tasks = nest.getAllTasks();
  const state = nest.getState();
  const now = Date.now();
  const elapsed = (now - state.metrics.startTime) / 60000; // minutes

  const metrics: ColonyMetrics = {
    tasksTotal: tasks.length,
    tasksDone: tasks.filter(t => t.status === "done").length,
    tasksFailed: tasks.filter(t => t.status === "failed").length,
    antsSpawned: state.ants.length,
    totalCost: state.ants.reduce((s, a) => s + a.usage.cost, 0),
    totalTokens: state.ants.reduce((s, a) => s + a.usage.input + a.usage.output, 0),
    startTime: state.metrics.startTime,
    throughputHistory: [
      ...state.metrics.throughputHistory,
      elapsed > 0 ? tasks.filter(t => t.status === "done").length / elapsed : 0,
    ].slice(-20),
  };

  nest.updateState({ metrics });
  return metrics;
}

interface WaveOptions {
  nest: Nest;
  cwd: string;
  caste: AntCaste;
  currentModel: string;
  modelOverrides?: ModelOverrides;
  signal?: AbortSignal;
  callbacks: QueenCallbacks;
  authStorage?: AuthStorage;
  modelRegistry?: ModelRegistry;
  importGraph?: ImportGraph;
}

/**
 * 并发执行一批蚂蚁，自适应调节并发度
 */
async function runAntWave(opts: WaveOptions): Promise<"ok" | "budget"> {
  const { nest, cwd, caste, signal, callbacks, currentModel } = opts;
  const casteModel = opts.modelOverrides?.[caste] || currentModel;
  const config = { ...DEFAULT_ANT_CONFIGS[caste], model: casteModel };

  let backoffMs = 0; // 429 退避时间
  let consecutiveRateLimits = 0; // 连续限流计数
  const retriedTasks = new Set<string>(); // 防止重复重试

  const runOne = async (): Promise<"done" | "empty" | "rate_limited" | "budget"> => {
    // Budget 刹车：预算用完就不出发（drone 免费，不检查）
    const state = nest.getState();
    if (state.maxCost != null && caste !== "drone") {
      const spent = state.ants.reduce((s, a) => s + a.usage.cost, 0);
      if (spent >= state.maxCost) return "budget";
    }

    const task = nest.nextPendingTask(caste);
    if (!task) return "empty";
    if (!nest.claimTask(task.id, "queen")) return "empty";

    const ant: Ant = {
      id: "", caste, status: "idle", taskId: task.id,
      pid: null, model: casteModel,
      usage: { input: 0, output: 0, cost: 0, turns: 0 },
      startedAt: Date.now(), finishedAt: null,
    };
    callbacks.onAntSpawn?.(ant, task);

    try {
      const result = caste === "drone"
        ? await runDrone(cwd, nest, task)
        : await spawnAnt(cwd, nest, task, config, signal, callbacks.onAntStream, opts.authStorage, opts.modelRegistry);
      callbacks.onAntDone?.(result.ant, task, result.output);

      if (result.rateLimited) {
        return "rate_limited";
      }

      // 蚂蚁产生的子任务加入巢穴
      for (const sub of result.newTasks) {
        // 检查文件锁冲突和依赖冲突
        const allTasks = nest.getAllTasks();
        const conflicting = allTasks.find(t =>
          t.status === "active" && (
            t.files.some(f => sub.files.includes(f)) ||
            (opts.importGraph && taskDependsOn(sub.files, t.files, opts.importGraph))
          )
        );
        const child = childTaskFromParsed(task.id, sub);
        if (conflicting) {
          child.status = "blocked";
        }
        nest.addSubTask(task.id, child);
      }

      // 更新指标
      const metrics = updateMetrics(nest);
      callbacks.onProgress?.(metrics);
      emitSignal("working", `${metrics.tasksDone}/${metrics.tasksTotal} tasks done`);

      return "done";
    } catch (e) {
      if (!retriedTasks.has(task.id)) {
        retriedTasks.add(task.id);
        nest.updateTaskStatus(task.id, "pending");
      } else {
        nest.updateTaskStatus(task.id, "failed", undefined, String(e));
      }
      return "done";
    }
  };

  // 调度循环：持续派蚂蚁直到没有待处理任务
  let lastSampleTime = 0;
  while (!signal?.aborted) {
    const state = nest.getState();
    const pending = state.tasks.filter(t => t.status === "pending" && t.caste === caste);
    if (pending.length === 0) break;

    // 429 退避：短暂等待后恢复，连续限流才逐步加长
    if (backoffMs > 0) {
      callbacks.onPhase?.("working", `Rate limited (429). Waiting ${Math.round(backoffMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, backoffMs));
    }

    // 解除 blocked 任务（如果锁定文件和依赖文件都已释放）
    const activeTasks = state.tasks.filter(t => t.status === "active");
    const activeFiles = new Set(activeTasks.flatMap(t => t.files));
    for (const t of state.tasks.filter(t => t.status === "blocked" && t.caste === caste)) {
      const fileConflict = t.files.some(f => activeFiles.has(f));
      const depConflict = opts.importGraph && activeTasks.some(at =>
        taskDependsOn(t.files, at.files, opts.importGraph!)
      );
      if (!fileConflict && !depConflict) {
        nest.updateTaskStatus(t.id, "pending");
      }
    }

    // 自适应并发（每 2000ms 采样一次）
    const now = Date.now();
    if (now - lastSampleTime >= 2000) {
      lastSampleTime = now;
      const completedRecently = state.tasks.filter(t =>
        t.status === "done" && t.finishedAt && t.finishedAt > now - 120000
      ).length;
      const sample = sampleSystem(
        state.ants.filter(a => a.status === "working").length,
        completedRecently,
        2,
      );
      nest.recordSample(sample);
    }

    const concurrency = adapt(state.concurrency, pending.length);
    nest.updateState({ concurrency });

    // 派出蚂蚁（并发数由 adapt 决定）
    const activeAnts = state.ants.filter(a => a.status === "working").length;
    const slotsAvailable = Math.max(0, concurrency.current - activeAnts);

    if (slotsAvailable === 0) {
      // 等待一下再检查
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    const batch = Math.min(slotsAvailable, pending.length);
    const promises: Promise<"done" | "empty" | "rate_limited" | "budget">[] = [];
    for (let i = 0; i < batch; i++) {
      promises.push(runOne());
    }
    const results = await Promise.all(promises);

    if (results.includes("budget")) {
      return "budget";
    }

    // 429 处理：降低并发 + 渐进退避（2s → 5s → 10s，上限 10s）
    if (results.includes("rate_limited")) {
      consecutiveRateLimits++;
      const cur = nest.getState().concurrency;
      const reduced = Math.max(cur.min, cur.current - 1); // 每次只减 1，不砍半
      nest.updateState({ concurrency: { ...cur, current: reduced } });
      backoffMs = Math.min(consecutiveRateLimits * 2000, 10000);
    } else {
      consecutiveRateLimits = 0;
      backoffMs = 0;
    }
  }
  return "ok";
}

/**
 * 蚁后主循环
 */
export async function runColony(opts: QueenOptions): Promise<ColonyState> {
  if (!opts.goal || !opts.goal.trim()) {
    throw new Error("Colony goal is empty or undefined. Please provide a clear goal.");
  }
  const colonyId = makeColonyId();
  const nest = new Nest(opts.cwd, colonyId);

  const initialState: ColonyState = {
    id: colonyId,
    goal: opts.goal,
    status: "scouting",
    tasks: [makeInitialScoutTask(opts.goal)],
    ants: [],
    pheromones: [],
    concurrency: defaultConcurrency(),
    metrics: {
      tasksTotal: 1, tasksDone: 0, tasksFailed: 0,
      antsSpawned: 0, totalCost: 0, totalTokens: 0,
      startTime: Date.now(), throughputHistory: [],
    },
    maxCost: opts.maxCost ?? null,
    modelOverrides: {},
    createdAt: Date.now(),
    finishedAt: null,
  };

  if (opts.maxAnts) {
    initialState.concurrency.max = opts.maxAnts;
  }

  nest.init(initialState);
  const { signal, callbacks } = opts;
  const waveBase: Omit<WaveOptions, "caste"> & { importGraph?: ImportGraph } = {
    nest, cwd: opts.cwd, signal, callbacks,
    currentModel: opts.currentModel,
    modelOverrides: opts.modelOverrides,
    authStorage: opts.authStorage,
    modelRegistry: opts.modelRegistry,
  };

  const cleanup = () => {
    nest.destroy();
    const parentDir = path.join(opts.cwd, ".ant-colony");
    try {
      const entries = fs.readdirSync(parentDir);
      if (entries.length === 0) fs.rmdirSync(parentDir);
    } catch { /* ignore */ }
  };

  const emitSignal = (phase: ColonyState["status"], message: string) => {
    const m = nest.getState().metrics;
    const active = nest.getState().ants.filter(a => a.status === "working").length;
    const progress = m.tasksTotal > 0 ? m.tasksDone / m.tasksTotal : 0;
    callbacks.onSignal?.({ phase, progress, active, cost: m.totalCost, message });
  };

  try {
    // ═══ Phase 1: 侦察（快速单次，不再多轮接力） ═══
    callbacks.onPhase?.("scouting", "Dispatching scout ant to explore codebase...");
    emitSignal("scouting", "Exploring codebase...");
    await runAntWave({ ...waveBase, caste: "scout" });

    let workerTasks = nest.getAllTasks().filter(t => (t.caste === "worker" || t.caste === "drone") && t.status === "pending");

    // 只在完全没有 worker 任务时才重试一次
    if (workerTasks.length === 0) {
      const pheromones = nest.getAllPheromones();
      const hasDiscoveries = pheromones.some(p => p.type === "discovery");
      const relayTask: Task = {
        id: makeTaskId(),
        parentId: null,
        title: "Scout relay: generate worker tasks",
        description: hasDiscoveries
          ? `Previous scout found information but didn't generate worker tasks. Generate concrete worker tasks based on discoveries.\n\nGoal:\n${opts.goal}`
          : `Explore the codebase for this goal and generate worker tasks:\n\n${opts.goal}`,
        caste: "scout",
        status: "pending",
        priority: 1,
        files: [],
        claimedBy: null,
        result: null,
        error: null,
        spawnedTasks: [],
        createdAt: Date.now(),
        startedAt: null,
        finishedAt: null,
      };
      nest.writeTask(relayTask);
      callbacks.onPhase?.("scouting", "Scout relay: generating worker tasks...");
      emitSignal("scouting", "Retrying scout...");
      await runAntWave({ ...waveBase, caste: "scout" });
      workerTasks = nest.getAllTasks().filter(t => (t.caste === "worker" || t.caste === "drone") && t.status === "pending");
    }

    if (workerTasks.length === 0) {
      nest.updateState({ status: "failed", finishedAt: Date.now() });
      const finalState = nest.getState();
      callbacks.onComplete?.(finalState);
      emitSignal("failed", "No tasks generated");
      return finalState;
    }

    // ═══ Phase 2: 工作 ═══
    nest.updateState({ status: "working" });

    // 构建 import graph 用于依赖感知调度
    let importGraph: ImportGraph | undefined;
    try {
      const allFiles = nest.getAllTasks().flatMap(t => t.files).filter(f => /\.[tj]sx?$/.test(f));
      if (allFiles.length > 0) {
        importGraph = buildImportGraph([...new Set(allFiles)], opts.cwd);
        waveBase.importGraph = importGraph;
      }
    } catch { /* graph build failed, proceed without */ }

    // 先执行 drone 任务（零 LLM 成本）
    const droneTasks = nest.getAllTasks().filter(t => t.caste === "drone" && t.status === "pending");
    if (droneTasks.length > 0) {
      callbacks.onPhase?.("working", `${droneTasks.length} drone tasks. Executing rules...`);
      emitSignal("working", `${droneTasks.length} drone tasks`);
      await runAntWave({ ...waveBase, caste: "drone" });
    }

    callbacks.onPhase?.("working", `${workerTasks.length} tasks discovered. Dispatching worker ants...`);
    emitSignal("working", `${workerTasks.length} tasks to do`);
    await runAntWave({ ...waveBase, caste: "worker" });

    // 处理工蚁产生的子任务（budget 驱动，无硬限制）
    while (true) {
      // 先跑 drone 子任务
      const pendingDrones = nest.getAllTasks().filter(t => t.caste === "drone" && t.status === "pending");
      if (pendingDrones.length > 0) await runAntWave({ ...waveBase, caste: "drone" });

      const remaining = nest.getAllTasks().filter(t =>
        t.caste === "worker" && (t.status === "pending" || t.status === "blocked")
      );
      if (remaining.length === 0) break;
      callbacks.onPhase?.("working", `${remaining.length} sub-tasks from workers...`);
      const result = await runAntWave({ ...waveBase, caste: "worker" });
      if (result === "budget") {
        nest.updateState({ status: "budget_exceeded", finishedAt: Date.now() });
        emitSignal("budget_exceeded", "Budget exhausted");
        const budgetState = nest.getState();
        callbacks.onComplete?.(budgetState);
        return budgetState;
      }
    }

    // ═══ Auto-check: run tsc before soldier review ═══
    let tscPassed = true;
    try {
      const { execSync } = await import("node:child_process");
      execSync("npx tsc --noEmit", { cwd: opts.cwd, timeout: 30000, stdio: "pipe" });
    } catch {
      tscPassed = false;
    }

    // ═══ Phase 3: 审查 ═══
    const completedWorkerTasks = nest.getAllTasks().filter(t => t.caste === "worker" && t.status === "done");
    if (completedWorkerTasks.length > 0 && (!tscPassed || completedWorkerTasks.length > 3)) {
      nest.updateState({ status: "reviewing" });
      callbacks.onPhase?.("reviewing", "Dispatching soldier ants to review changes...");
      emitSignal("reviewing", "Reviewing changes...");
      const reviewTask = makeReviewTask(completedWorkerTasks);
      nest.writeTask(reviewTask);
      await runAntWave({ ...waveBase, caste: "soldier" });

      // 兵蚁产生的修复任务
      const fixTasks = nest.getAllTasks().filter(t =>
        t.caste === "worker" && t.status === "pending" && t.parentId !== null
      );
      if (fixTasks.length > 0) {
        nest.updateState({ status: "working" });
        callbacks.onPhase?.("working", `${fixTasks.length} fix tasks from review. Dispatching workers...`);
        await runAntWave({ ...waveBase, caste: "worker" });
      }
    }

    // ═══ Phase 4: 完成 ═══
    const finalMetrics = updateMetrics(nest);
    nest.updateState({ status: "done", finishedAt: Date.now(), metrics: finalMetrics });
    const finalState = nest.getState();
    callbacks.onComplete?.(finalState);
    emitSignal("done", `${finalMetrics.tasksDone}/${finalMetrics.tasksTotal} tasks done`);
    return finalState;

  } catch (e) {
    nest.updateState({ status: "failed", finishedAt: Date.now() });
    const failState = nest.getState();
    callbacks.onComplete?.(failState);
    emitSignal("failed", String(e).slice(0, 100));
    return failState;
  } finally {
    cleanup();
  }
}
