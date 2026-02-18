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
import { spawnAnt, runDrone, makeTaskId, makePheromoneId, resetAntCounter } from "./spawner.js";
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

/**
 * Bio 5: 蚁群投票 — 合并多 Scout 产生的重复任务
 * 相同文件集合的任务合并，被多 Scout 提及的任务 priority 提升
 */
export function quorumMergeTasks(nest: Nest): void {
  const tasks = nest.getAllTasks().filter(t =>
    (t.caste === "worker" || t.caste === "drone") && t.status === "pending"
  );
  if (tasks.length < 2) return;

  // 按文件集合分组（排序后 join 作为 key）
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = [...t.files].sort().join("|") || t.title;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    // 保留第一个，删除重复的，合并 description
    const keeper = group[0];
    // Quorum 达成：被多 Scout 提及 → priority 提升
    keeper.priority = Math.max(1, keeper.priority - 1) as 1 | 2 | 3 | 4 | 5;
    // 合并其他任务的 context 到 keeper
    for (let i = 1; i < group.length; i++) {
      const dup = group[i];
      if (dup.context && dup.context !== keeper.context) {
        keeper.context = (keeper.context || "") + "\n\n--- Additional scout context ---\n" + dup.context;
      }
      // 标记重复任务为 done（已合并）
      nest.updateTaskStatus(dup.id, "done", `Merged into ${keeper.id} (quorum)`);
    }
    nest.writeTask(keeper);
  }
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
  const state = nest.getStateLight();
  const tasks = state.tasks;
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
  emitSignal: (phase: ColonyState["status"], message: string) => void;
  authStorage?: AuthStorage;
  modelRegistry?: ModelRegistry;
  importGraph?: ImportGraph;
}

/**
 * Bio 6: 尸体清理 — 错误模式分类
 */
export function classifyError(errStr: string): string {
  if (errStr.includes("TypeError") || errStr.includes("type") || errStr.includes("TS")) return "type_error";
  if (errStr.includes("permission") || errStr.includes("401") || errStr.includes("EACCES")) return "permission";
  if (errStr.includes("timeout") || errStr.includes("Timeout") || errStr.includes("ETIMEDOUT")) return "timeout";
  if (errStr.includes("ENOENT") || errStr.includes("not found") || errStr.includes("Cannot find")) return "not_found";
  if (errStr.includes("syntax") || errStr.includes("SyntaxError") || errStr.includes("Unexpected")) return "syntax";
  if (errStr.includes("429") || errStr.includes("rate limit")) return "rate_limit";
  return "unknown";
}

/**
 * 并发执行一批蚂蚁，自适应调节并发度
 */
async function runAntWave(opts: WaveOptions): Promise<"ok" | "budget"> {
  const { nest, cwd, caste, signal, callbacks, currentModel, emitSignal } = opts;
  const casteModel = opts.modelOverrides?.[caste] || currentModel;
  const baseConfig = { ...DEFAULT_ANT_CONFIGS[caste], model: casteModel };

  let backoffMs = 0; // 429 退避时间
  let consecutiveRateLimits = 0; // 连续限流计数
  const retryCount = new Map<string, number>(); // taskId → retry count
  const MAX_RETRIES = 2;

  // Bio 6: 尸体清理 — 错误模式追踪
  const errorPatterns = new Map<string, { count: number; files: Set<string>; errors: string[] }>();

  const runOne = async (): Promise<"done" | "empty" | "rate_limited" | "budget"> => {
    // Budget 刹车：预算用完就不出发（drone 免费，不检查）
    const state = nest.getStateLight();
    if (state.maxCost != null && caste !== "drone") {
      const spent = state.ants.reduce((s, a) => s + a.usage.cost, 0);
      if (spent >= state.maxCost) return "budget";

      // Bio 4: 巢穴温度 — 成本渐进调控
      const temperature = spent / state.maxCost;
      if (temperature > 0.9) {
        // 紧急模式：只跑 priority 1 任务
        const pending = state.tasks.filter(t => t.status === "pending" && t.caste === caste);
        if (!pending.some(t => t.priority === 1)) return "budget";
      }
    }

    const task = nest.claimNextTask(caste, "queen");
    if (!task) return "empty";

    const ant: Ant = {
      id: "", caste, status: "idle", taskId: task.id,
      pid: null, model: casteModel,
      usage: { input: 0, output: 0, cost: 0, turns: 0 },
      startedAt: Date.now(), finishedAt: null,
    };
    callbacks.onAntSpawn?.(ant, task);

    try {
      const ANT_TIMEOUT = 5 * 60 * 1000; // 5 min hard timeout per ant
      const antAbort = new AbortController();
      signal?.addEventListener("abort", () => antAbort.abort(), { once: true });
      const antSignal = antAbort.signal;
      // Bio 7: 年龄多态 — 前期保守，后期收敛
      const progress = state.metrics.tasksTotal > 0 ? state.metrics.tasksDone / state.metrics.tasksTotal : 0;
      const config = { ...baseConfig };
      if (progress < 0.3) {
        config.maxTurns = Math.max(baseConfig.maxTurns - 3, 5); // 前期保守
      } else if (progress > 0.7) {
        config.maxTurns = Math.max(baseConfig.maxTurns - 5, 5); // 后期收敛，只修复收尾
      }
      const antPromise = caste === "drone"
        ? runDrone(cwd, nest, task)
        : spawnAnt(cwd, nest, task, config, antSignal, callbacks.onAntStream, opts.authStorage, opts.modelRegistry);
      let timeoutId: ReturnType<typeof setTimeout>;
      const result = await Promise.race([
        antPromise.finally(() => clearTimeout(timeoutId)),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => { antAbort.abort(); reject(new Error("Ant timeout (5min)")); }, ANT_TIMEOUT);
        }),
      ]);
      callbacks.onAntDone?.(result.ant, task, result.output);

      if (result.rateLimited) {
        return "rate_limited";
      }

      // 成本预警：超 80% 预算时发信号
      const curState = nest.getStateLight();
      if (curState.maxCost != null) {
        const spent = curState.ants.reduce((s, a) => s + a.usage.cost, 0);
        if (spent >= curState.maxCost * 0.8) {
          emitSignal("working", `Budget warning: ${(spent / curState.maxCost * 100).toFixed(0)}% used`);
        }
      }

      // 蚂蚁产生的子任务加入巢穴（限制繁殖上限，防止任务膨胀）
      // Bio 7: 年龄多态 — 后期限制子任务生成
      const m = curState.metrics;
      const colonyProgress = m.tasksTotal > 0 ? m.tasksDone / m.tasksTotal : 0;
      const MAX_TOTAL_TASKS = 30;
      const MAX_SUB_PER_TASK = colonyProgress > 0.7 ? 2 : 5; // 后期收敛
      const accepted = result.newTasks.slice(0, MAX_SUB_PER_TASK);
      for (const sub of accepted) {
        if (nest.getAllTasks().length >= MAX_TOTAL_TASKS) break;
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

      // 路径强化：成功完成释放 completion 信息素，强度与任务规模成正比（招募信号）
      if (task.files.length > 0) {
        const recruitStrength = Math.min(1.0, 0.5 + task.files.length * 0.1 + result.newTasks.length * 0.15);
        nest.dropPheromone({
          id: makePheromoneId(), type: "completion", antId: result.ant.id,
          antCaste: caste, taskId: task.id,
          content: `Success: ${task.title}`,
          files: task.files, strength: recruitStrength, createdAt: Date.now(),
        });
      }

      // 更新指标
      const metrics = updateMetrics(nest);
      callbacks.onProgress?.(metrics);
      emitSignal("working", `${metrics.tasksDone}/${metrics.tasksTotal} tasks done`);

      return "done";
    } catch (e) {
      const errStr = String(e);
      const isRetryable = errStr.includes("timeout") || errStr.includes("Timeout") || errStr.includes("ECONNRESET") || errStr.includes("429");
      const count = retryCount.get(task.id) ?? 0;
      if (isRetryable && count < MAX_RETRIES) {
        retryCount.set(task.id, count + 1);
        nest.updateTaskStatus(task.id, "pending");
      } else {
        // 负信息素：失败任务释放 warning，强度与任务规模成正比
        if (task.files.length > 0) {
          const warnStrength = Math.min(1.0, 0.5 + task.files.length * 0.1);
          nest.dropPheromone({
            id: makePheromoneId(), type: "warning", antId: "queen",
            antCaste: caste, taskId: task.id,
            content: `Failed: ${task.title} — ${String(e).slice(0, 100)}`,
            files: task.files, strength: warnStrength, createdAt: Date.now(),
          });
        }
        nest.updateTaskStatus(task.id, "failed", undefined, String(e));

        // Bio 6: 尸体清理 — 错误模式追踪 + 诊断任务
        const pattern = classifyError(errStr);
        const entry = errorPatterns.get(pattern) ?? { count: 0, files: new Set<string>(), errors: [] };
        entry.count++;
        for (const f of task.files) entry.files.add(f);
        entry.errors.push(errStr.slice(0, 200));
        errorPatterns.set(pattern, entry);

        if (entry.count >= 2 && entry.files.size > 0) {
          const affectedFiles = [...entry.files];
          // 释放 repellent 信息素
          nest.dropPheromone({
            id: makePheromoneId(), type: "repellent", antId: "queen",
            antCaste: caste, taskId: task.id,
            content: `Recurring ${pattern} errors (${entry.count}x): ${entry.errors[0]?.slice(0, 80)}`,
            files: affectedFiles, strength: 1.0, createdAt: Date.now(),
          });
          // 生成诊断任务（仅首次触发）
          if (entry.count === 2 && nest.getAllTasks().length < 30) {
            const diagTask: Task = {
              id: makeTaskId(), parentId: null,
              title: `Diagnose recurring ${pattern} errors`,
              description: `Multiple ants failed with ${pattern} errors on these files:\n${affectedFiles.map(f => `- ${f}`).join("\n")}\n\nErrors:\n${entry.errors.map(e => `- ${e}`).join("\n")}\n\nInvestigate root cause and generate fix tasks.`,
              caste: "scout", status: "pending", priority: 1,
              files: affectedFiles, claimedBy: null, result: null, error: null,
              spawnedTasks: [], createdAt: Date.now(), startedAt: null, finishedAt: null,
            };
            nest.writeTask(diagTask);
            emitSignal("working", `Diagnosing recurring ${pattern} errors...`);
          }
        }
      }
      return "done";
    }
  };

  // 调度循环：持续派蚂蚁直到没有待处理任务
  let lastSampleTime = 0;
  while (!signal?.aborted) {
    const state = nest.getStateLight();
    const pending = state.tasks.filter(t => t.status === "pending" && t.caste === caste);
    if (pending.length === 0) break;

    // 429 退避：短暂等待后恢复，连续限流才逐步加长
    if (backoffMs > 0) {
      callbacks.onPhase?.("working", `Rate limited (429). Waiting ${Math.round(backoffMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, backoffMs));
    }

    // 解除 blocked 任务（如果锁定文件和依赖文件都已释放）
    const activeTasks = state.tasks.filter(t => t.status === "active" || t.status === "claimed");
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

    // 429 处理：降低并发 + 渐进退避（2s → 5s → 10s，上限 10s）+ 记录时间戳
    if (results.includes("rate_limited")) {
      consecutiveRateLimits++;
      const cur = nest.getStateLight().concurrency;
      const reduced = Math.max(cur.min, cur.current - 1); // 每次只减 1，不砍半
      nest.updateState({ concurrency: { ...cur, current: reduced, lastRateLimitAt: Date.now() } });
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
  resetAntCounter();
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

  const cleanup = () => {
    nest.destroy();
    const parentDir = path.join(opts.cwd, ".ant-colony");
    try {
      const entries = fs.readdirSync(parentDir);
      if (entries.length === 0) fs.rmdirSync(parentDir);
    } catch { /* ignore */ }
  };

  const emitSignal = (phase: ColonyState["status"], message: string) => {
    const state = nest.getStateLight();
    const m = state.metrics;
    const active = state.ants.filter(a => a.status === "working").length;
    const progress = m.tasksTotal > 0 ? m.tasksDone / m.tasksTotal : 0;
    callbacks.onSignal?.({ phase, progress, active, cost: m.totalCost, message });
  };

  const waveBase: Omit<WaveOptions, "caste"> & { importGraph?: ImportGraph } = {
    nest, cwd: opts.cwd, signal, callbacks, emitSignal,
    currentModel: opts.currentModel,
    modelOverrides: opts.modelOverrides,
    authStorage: opts.authStorage,
    modelRegistry: opts.modelRegistry,
  };

  try {
    // ═══ Phase 1: 侦察（Bio 5: 蚁群投票 — 复杂目标派多 Scout） ═══
    const scoutCount = opts.goal.length > 500 ? 3 : opts.goal.length > 200 ? 2 : 1;
    if (scoutCount > 1) {
      // 多 Scout 并行：为每只 Scout 创建独立任务
      for (let i = 1; i < scoutCount; i++) {
        const extraScout: Task = {
          id: makeTaskId(),
          parentId: null,
          title: `Scout ${i + 1}: explore codebase for goal`,
          description: `Explore the codebase from a different angle and identify files, modules, and dependencies relevant to this goal:\n\n${opts.goal}\n\nFocus on areas other scouts might miss. Be thorough.`,
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
        nest.writeTask(extraScout);
      }
    }
    callbacks.onPhase?.("scouting", `Dispatching ${scoutCount} scout ant(s) to explore codebase...`);
    emitSignal("scouting", `${scoutCount} scouts exploring...`);
    await runAntWave({ ...waveBase, caste: "scout" });

    // Bio 5: 合并多 Scout 产生的重复任务
    if (scoutCount > 1) quorumMergeTasks(nest);

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

    // ═══ 持续探索：Worker 完成后检查是否有新发现，有则再派 Scout ═══
    // Bio 4: 巢穴温度 — 超过 50% 预算禁止新 Scout 探索
    const discoveries = nest.getAllPheromones().filter(p => p.type === "discovery");
    const allDone = nest.getAllTasks().filter(t => t.status === "done");
    const preExploreSpent = nest.getStateLight().ants.reduce((s, a) => s + a.usage.cost, 0);
    const preExploreBudget = nest.getStateLight().maxCost ?? Infinity;
    const costTemperature = preExploreSpent / preExploreBudget;
    if (discoveries.length > allDone.length && costTemperature < 0.5) {
      if (preExploreSpent < preExploreBudget) {
        callbacks.onPhase?.("scouting", "Re-exploring based on new discoveries...");
        emitSignal("scouting", "Re-exploring...");
        await runAntWave({ ...waveBase, caste: "scout" });

        const newTasks = nest.getAllTasks().filter(t =>
          (t.caste === "worker" || t.caste === "drone") && t.status === "pending"
        );
        if (newTasks.length > 0) {
          const drones = newTasks.filter(t => t.caste === "drone");
          if (drones.length > 0) await runAntWave({ ...waveBase, caste: "drone" });

          callbacks.onPhase?.("working", `${newTasks.length} new tasks from re-exploration`);
          emitSignal("working", `${newTasks.length} new tasks`);
          const result = await runAntWave({ ...waveBase, caste: "worker" });
          if (result === "budget") {
            nest.updateState({ status: "budget_exceeded", finishedAt: Date.now() });
            emitSignal("budget_exceeded", "Budget exhausted");
            const budgetState = nest.getState();
            callbacks.onComplete?.(budgetState);
            return budgetState;
          }
        }
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
    const finalStatus = nest.getState().status;
    if (finalStatus === "done") cleanup();
  }
}

/**
 * 从检查点恢复蚁群 — 跳过已完成的阶段，继续执行未完成的任务
 */
export async function resumeColony(opts: QueenOptions): Promise<ColonyState> {
  const found = Nest.findResumable(opts.cwd);
  if (!found) return runColony(opts); // 无可恢复状态，正常启动

  const nest = new Nest(opts.cwd, found.colonyId);
  nest.restore();

  const { signal, callbacks } = opts;

  const emitSignal = (phase: ColonyState["status"], message: string) => {
    const state = nest.getStateLight();
    const m = state.metrics;
    const active = state.ants.filter(a => a.status === "working").length;
    const progress = m.tasksTotal > 0 ? m.tasksDone / m.tasksTotal : 0;
    callbacks.onSignal?.({ phase, progress, active, cost: m.totalCost, message });
  };

  const waveBase: Omit<WaveOptions, "caste"> = {
    nest, cwd: opts.cwd, signal, callbacks, emitSignal,
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

  callbacks.onPhase?.("working", "Resuming colony from checkpoint...");
  emitSignal("working", "Resuming...");

  try {
    // 执行所有 pending 任务
    const pendingDrones = nest.getAllTasks().filter(t => t.caste === "drone" && t.status === "pending");
    if (pendingDrones.length > 0) await runAntWave({ ...waveBase, caste: "drone" });

    const pendingWorkers = nest.getAllTasks().filter(t => t.caste === "worker" && t.status === "pending");
    if (pendingWorkers.length > 0) {
      const result = await runAntWave({ ...waveBase, caste: "worker" });
      if (result === "budget") {
        nest.updateState({ status: "budget_exceeded", finishedAt: Date.now() });
        emitSignal("budget_exceeded", "Budget exhausted");
        const s = nest.getState();
        callbacks.onComplete?.(s);
        return s;
      }
    }

    // Soldier review for resumed colony（条件与 runColony 对齐）
    let tscPassed = true;
    try {
      const { execSync } = await import("node:child_process");
      execSync("npx tsc --noEmit", { cwd: opts.cwd, timeout: 30000, stdio: "pipe" });
    } catch { tscPassed = false; }

    const completedWorkerTasks = nest.getAllTasks().filter(t => t.caste === "worker" && t.status === "done");
    if (completedWorkerTasks.length > 0 && (!tscPassed || completedWorkerTasks.length > 3)) {
      nest.updateState({ status: "reviewing" });
      const reviewTask = makeReviewTask(completedWorkerTasks);
      nest.writeTask(reviewTask);
      await runAntWave({ ...waveBase, caste: "soldier" });
      const fixTasks = nest.getAllTasks().filter(t => t.caste === "worker" && t.status === "pending" && t.parentId !== null);
      if (fixTasks.length > 0) {
        nest.updateState({ status: "working" });
        await runAntWave({ ...waveBase, caste: "worker" });
      }
    }

    const finalMetrics = updateMetrics(nest);
    nest.updateState({ status: "done", finishedAt: Date.now(), metrics: finalMetrics });
    const finalState = nest.getState();
    callbacks.onComplete?.(finalState);
    emitSignal("done", `Resumed: ${finalMetrics.tasksDone}/${finalMetrics.tasksTotal} tasks done`);
    return finalState;

  } catch (e) {
    nest.updateState({ status: "failed", finishedAt: Date.now() });
    const failState = nest.getState();
    callbacks.onComplete?.(failState);
    emitSignal("failed", String(e).slice(0, 100));
    return failState;
  } finally {
    const finalStatus = nest.getState().status;
    if (finalStatus === "done") cleanup();
  }
}
