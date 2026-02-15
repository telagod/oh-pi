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

import type {
  ColonyState, Task, Ant, AntCaste, ColonyMetrics,
  ConcurrencyConfig, TaskPriority, ModelOverrides,
} from "./types.js";
import { DEFAULT_ANT_CONFIGS } from "./types.js";
import { Nest } from "./nest.js";
import { spawnAnt, makeTaskId } from "./spawner.js";
import { adapt, sampleSystem, defaultConcurrency } from "./concurrency.js";

export interface QueenCallbacks {
  onPhase(phase: ColonyState["status"], detail: string): void;
  onAntSpawn(ant: Ant, task: Task): void;
  onAntDone(ant: Ant, task: Task, output: string): void;
  onProgress(metrics: ColonyMetrics): void;
  onComplete(state: ColonyState): void;
}

export interface QueenOptions {
  cwd: string;
  goal: string;
  maxAnts?: number;
  maxCost?: number;
  modelOverrides?: ModelOverrides;
  signal?: AbortSignal;
  callbacks: QueenCallbacks;
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
  parsed: { title: string; description: string; files: string[]; caste: AntCaste; priority: TaskPriority },
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

/**
 * 并发执行一批蚂蚁，自适应调节并发度
 */
async function runAntWave(
  nest: Nest,
  cwd: string,
  caste: AntCaste,
  signal: AbortSignal | undefined,
  callbacks: QueenCallbacks,
  modelOverrides?: ModelOverrides,
  maxCost?: number,
): Promise<"ok" | "budget_exceeded"> {
  const config = { ...DEFAULT_ANT_CONFIGS[caste] };
  if (modelOverrides?.[caste]) config.model = modelOverrides[caste];

  let backoffMs = 0; // 429 退避时间

  const runOne = async (): Promise<"done" | "empty" | "rate_limited"> => {
    const task = nest.nextPendingTask(caste);
    if (!task) return "empty";
    if (!nest.claimTask(task.id, "queen")) return "empty";

    const ant: Ant = {
      id: "", caste, status: "idle", taskId: task.id,
      pid: null, usage: { input: 0, output: 0, cost: 0, turns: 0 },
      startedAt: Date.now(), finishedAt: null,
    };
    callbacks.onAntSpawn(ant, task);

    try {
      const result = await spawnAnt(cwd, nest, task, config, signal);
      callbacks.onAntDone(result.ant, task, result.output);

      if (result.rateLimited) {
        return "rate_limited";
      }

      // 蚂蚁产生的子任务加入巢穴
      for (const sub of result.newTasks) {
        // 检查文件锁冲突
        const allTasks = nest.getAllTasks();
        const conflicting = allTasks.find(t =>
          t.status === "active" &&
          t.files.some(f => sub.files.includes(f))
        );
        const child = childTaskFromParsed(task.id, sub);
        if (conflicting) {
          child.status = "blocked";
        }
        nest.addSubTask(task.id, child);
      }

      // 更新指标
      const metrics = updateMetrics(nest);
      callbacks.onProgress(metrics);

      return "done";
    } catch (e) {
      nest.updateTaskStatus(task.id, "failed", undefined, String(e));
      return "done";
    }
  };

  // 调度循环：持续派蚂蚁直到没有待处理任务
  while (!signal?.aborted) {
    // Budget check
    if (maxCost != null) {
      const currentCost = nest.getState().ants.reduce((s, a) => s + a.usage.cost, 0);
      if (currentCost >= maxCost) {
        callbacks.onPhase("working", `Budget exceeded ($${currentCost.toFixed(3)} >= $${maxCost.toFixed(2)}). Stopping.`);
        return "budget_exceeded";
      }
    }

    const state = nest.getState();
    const pending = state.tasks.filter(t => t.status === "pending" && t.caste === caste);
    if (pending.length === 0) break;

    // 429 退避：等待后恢复
    if (backoffMs > 0) {
      callbacks.onPhase("working", `Rate limited (429). Backing off ${Math.round(backoffMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, backoffMs));
      backoffMs = 0;
    }

    // 解除 blocked 任务（如果锁定文件已释放）
    const activeTasks = state.tasks.filter(t => t.status === "active");
    const activeFiles = new Set(activeTasks.flatMap(t => t.files));
    for (const t of state.tasks.filter(t => t.status === "blocked" && t.caste === caste)) {
      if (!t.files.some(f => activeFiles.has(f))) {
        nest.updateTaskStatus(t.id, "pending");
      }
    }

    // 自适应并发
    const completedRecently = state.tasks.filter(t =>
      t.status === "done" && t.finishedAt && t.finishedAt > Date.now() - 120000
    ).length;
    const sample = sampleSystem(
      state.ants.filter(a => a.status === "working").length,
      completedRecently,
      2,
    );
    nest.recordSample(sample);

    const concurrency = adapt(state.concurrency, pending.length);
    nest.updateState({ concurrency });

    // 派出蚂蚁（并发数由 adapt 决定）
    const activeAnts = state.ants.filter(a => a.status === "working").length;
    const slotsAvailable = Math.max(0, concurrency.current - activeAnts);

    if (slotsAvailable === 0) {
      // 等待一下再检查
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    const batch = Math.min(slotsAvailable, pending.length);
    const promises: Promise<"done" | "empty" | "rate_limited">[] = [];
    for (let i = 0; i < batch; i++) {
      promises.push(runOne());
    }
    const results = await Promise.all(promises);

    // 429 处理：任何蚂蚁遇到限流 → 降低并发 + 指数退避
    if (results.includes("rate_limited")) {
      const cur = nest.getState().concurrency;
      const reduced = Math.max(cur.min, Math.floor(cur.current / 2));
      nest.updateState({ concurrency: { ...cur, current: reduced } });
      // 指数退避：15s → 30s → 60s，上限 60s
      backoffMs = backoffMs === 0 ? 15000 : Math.min(backoffMs * 2, 60000);
    } else {
      // 成功时逐步恢复退避计数
      backoffMs = 0;
    }
  }
  return "ok";
}

/**
 * 蚁后主循环
 */
export async function runColony(opts: QueenOptions): Promise<ColonyState> {
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
    modelOverrides: opts.modelOverrides ?? {},
    createdAt: Date.now(),
    finishedAt: null,
  };

  if (opts.maxAnts) {
    initialState.concurrency.max = opts.maxAnts;
  }

  nest.init(initialState);
  const { signal, callbacks } = opts;
  const mo = opts.modelOverrides;
  const mc = opts.maxCost;

  const budgetStop = (phase: string) => {
    nest.updateState({ status: "budget_exceeded", finishedAt: Date.now() });
    callbacks.onPhase("budget_exceeded" as any, phase);
    const s = nest.getState();
    callbacks.onComplete(s);
    return s;
  };

  try {
    // ═══ Phase 1: 侦察 ═══
    callbacks.onPhase("scouting", "Dispatching scout ants to explore codebase...");
    if (await runAntWave(nest, opts.cwd, "scout", signal, callbacks, mo, mc) === "budget_exceeded")
      return budgetStop("Budget exceeded during scouting");

    // 检查侦察结果，如果没有产生工蚁任务，用侦察结果让女王自己拆
    const postScout = nest.getAllTasks();
    const workerTasks = postScout.filter(t => t.caste === "worker" && t.status === "pending");
    if (workerTasks.length === 0) {
      // 侦察蚁没产生任务，标记失败
      nest.updateState({ status: "failed", finishedAt: Date.now() });
      const finalState = nest.getState();
      callbacks.onComplete(finalState);
      return finalState;
    }

    // ═══ Phase 2: 工作 ═══
    nest.updateState({ status: "working" });
    callbacks.onPhase("working", `${workerTasks.length} tasks discovered. Dispatching worker ants...`);
    if (await runAntWave(nest, opts.cwd, "worker", signal, callbacks, mo, mc) === "budget_exceeded")
      return budgetStop("Budget exceeded during working");

    // 处理工蚁产生的子任务（可能有多轮）
    let rounds = 0;
    while (rounds < 3) {
      const remaining = nest.getAllTasks().filter(t =>
        t.caste === "worker" && (t.status === "pending" || t.status === "blocked")
      );
      if (remaining.length === 0) break;
      rounds++;
      callbacks.onPhase("working", `Round ${rounds + 1}: ${remaining.length} sub-tasks from workers...`);
      if (await runAntWave(nest, opts.cwd, "worker", signal, callbacks, mo, mc) === "budget_exceeded")
        return budgetStop("Budget exceeded during sub-tasks");
    }

    // ═══ Phase 3: 审查 ═══
    const completedWorkerTasks = nest.getAllTasks().filter(t => t.caste === "worker" && t.status === "done");
    if (completedWorkerTasks.length > 0) {
      nest.updateState({ status: "reviewing" });
      callbacks.onPhase("reviewing", "Dispatching soldier ants to review changes...");
      const reviewTask = makeReviewTask(completedWorkerTasks);
      nest.writeTask(reviewTask);
      if (await runAntWave(nest, opts.cwd, "soldier", signal, callbacks, mo, mc) === "budget_exceeded")
        return budgetStop("Budget exceeded during review");

      // 兵蚁产生的修复任务
      const fixTasks = nest.getAllTasks().filter(t =>
        t.caste === "worker" && t.status === "pending" && t.parentId !== null
      );
      if (fixTasks.length > 0) {
        nest.updateState({ status: "working" });
        callbacks.onPhase("working", `${fixTasks.length} fix tasks from review. Dispatching workers...`);
        if (await runAntWave(nest, opts.cwd, "worker", signal, callbacks, mo, mc) === "budget_exceeded")
          return budgetStop("Budget exceeded during fixes");
      }
    }

    // ═══ Phase 4: 完成 ═══
    const finalMetrics = updateMetrics(nest);
    nest.updateState({ status: "done", finishedAt: Date.now(), metrics: finalMetrics });
    const finalState = nest.getState();
    callbacks.onComplete(finalState);
    return finalState;

  } catch (e) {
    nest.updateState({ status: "failed", finishedAt: Date.now() });
    const failState = nest.getState();
    callbacks.onComplete(failState);
    return failState;
  }
}
