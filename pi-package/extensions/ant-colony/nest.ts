/**
 * 巢穴 (Nest) — 蚁群共享状态，基于文件系统的跨进程协调
 *
 * .ant-colony/{colonyId}/
 *   state.json      — 蚁巢主状态
 *   pheromone.jsonl  — 信息素追加日志
 *   tasks/           — 每个任务一个文件，原子更新
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ColonyState, Task, Pheromone, Ant, TaskStatus, ConcurrencySample } from "./types.js";

export class Nest {
  readonly dir: string;
  private stateFile: string;
  private lockFile: string;
  private pheromoneFile: string;
  private tasksDir: string;
  private pheromoneCache: Pheromone[] = [];
  private pheromoneOffset: number = 0;
  private taskCache: Map<string, Task> = new Map();

  constructor(private cwd: string, private colonyId: string) {
    this.dir = path.join(cwd, ".ant-colony", colonyId);
    this.stateFile = path.join(this.dir, "state.json");
    this.lockFile = path.join(this.dir, "state.lock");
    this.pheromoneFile = path.join(this.dir, "pheromone.jsonl");
    this.tasksDir = path.join(this.dir, "tasks");
    fs.mkdirSync(this.tasksDir, { recursive: true });
  }

  // ═══ State ═══

  init(state: ColonyState): void {
    this.writeJson(this.stateFile, state);
    this.taskCache.clear();
    for (const t of state.tasks) this.writeTask(t);
  }

  getState(): ColonyState {
    const base = this.readJson<ColonyState>(this.stateFile);
    // 从 tasks/ 目录重建最新任务状态（原子性保证）
    base.tasks = this.getAllTasks();
    base.pheromones = this.getAllPheromones();
    return base;
  }

  updateState(patch: Partial<Pick<ColonyState, "status" | "concurrency" | "metrics" | "ants" | "finishedAt">>): void {
    this.withStateLock(() => {
      const state = this.readJson<ColonyState>(this.stateFile);
      Object.assign(state, patch);
      this.writeJson(this.stateFile, state);
    });
  }

  // ═══ Tasks (Food) ═══

  writeTask(task: Task): void {
    this.writeJson(path.join(this.tasksDir, `${task.id}.json`), task);
    this.taskCache.set(task.id, task);
  }

  getTask(id: string): Task | null {
    const cached = this.taskCache.get(id);
    if (cached) return cached;
    const f = path.join(this.tasksDir, `${id}.json`);
    if (!fs.existsSync(f)) return null;
    const task = this.readJson<Task>(f);
    this.taskCache.set(id, task);
    return task;
  }

  getAllTasks(): Task[] {
    if (this.taskCache.size > 0) return Array.from(this.taskCache.values());
    try {
      const tasks = fs.readdirSync(this.tasksDir)
        .filter(f => f.endsWith(".json"))
        .map(f => this.readJson<Task>(path.join(this.tasksDir, f)));
      for (const t of tasks) this.taskCache.set(t.id, t);
      return tasks;
    } catch (e) { console.error("[nest] failed to read tasks dir:", e); return []; }
  }

  claimTask(taskId: string, antId: string): boolean {
    const task = this.getTask(taskId);
    if (!task || task.status !== "pending") return false;
    task.status = "claimed";
    task.claimedBy = antId;
    this.writeTask(task);
    return true;
  }

  updateTaskStatus(taskId: string, status: TaskStatus, result?: string, error?: string): void {
    const task = this.getTask(taskId);
    if (!task) return;
    task.status = status;
    if (status === "active") task.startedAt = Date.now();
    if (status === "done" || status === "failed") task.finishedAt = Date.now();
    if (result !== undefined) task.result = result;
    if (error !== undefined) task.error = error;
    this.writeTask(task);
  }

  addSubTask(parentId: string, child: Task): void {
    this.writeTask(child);
    const parent = this.getTask(parentId);
    if (parent) {
      parent.spawnedTasks.push(child.id);
      this.writeTask(parent);
    }
  }

  /** 获取下一个可领取的任务（按优先级 + 信息素强度排序） */
  nextPendingTask(caste: "scout" | "worker" | "soldier"): Task | null {
    const tasks = this.getAllTasks()
      .filter(t => t.status === "pending" && t.caste === caste);
    if (tasks.length === 0) return null;

    // 按优先级排序，同优先级按创建时间
    tasks.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);

    // 信息素加权：有相关 discovery 信息素的任务优先
    const pheromones = this.getAllPheromones();
    const scored = tasks.map(t => {
      const relevantP = pheromones.filter(p =>
        p.type === "discovery" &&
        p.files.some(f => t.files.includes(f)) &&
        p.strength > 0.1
      );
      const pScore = relevantP.reduce((sum, p) => sum + p.strength, 0);
      return { task: t, score: (6 - t.priority) + pScore };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.task ?? null;
  }

  // ═══ Pheromones ═══

  dropPheromone(p: Pheromone): void {
    fs.appendFileSync(this.pheromoneFile, JSON.stringify(p) + "\n");
  }

  getAllPheromones(): Pheromone[] {
    if (!fs.existsSync(this.pheromoneFile)) return [];
    const HALF_LIFE = 10 * 60 * 1000; // 10 分钟半衰期
    const now = Date.now();

    // 增量读取：只读 offset 之后的新数据
    const stat = fs.statSync(this.pheromoneFile);
    if (stat.size > this.pheromoneOffset) {
      const fd = fs.openSync(this.pheromoneFile, "r");
      const buf = Buffer.alloc(stat.size - this.pheromoneOffset);
      fs.readSync(fd, buf, 0, buf.length, this.pheromoneOffset);
      fs.closeSync(fd);
      const newLines = buf.toString("utf-8").split("\n").filter(Boolean);
      for (const line of newLines) {
        this.pheromoneCache.push(JSON.parse(line) as Pheromone);
      }
      this.pheromoneOffset = stat.size;
    }

    // 衰减 + 过滤弱信息素
    this.pheromoneCache = this.pheromoneCache.filter(p => {
      p.strength = p.strength * Math.pow(0.5, (now - p.createdAt) / HALF_LIFE);
      return p.strength > 0.05;
    });

    return this.pheromoneCache;
  }

  /** 读取与特定文件相关的信息素摘要 */
  getPheromoneContext(files: string[], limit = 20): string {
    const relevant = this.getAllPheromones()
      .filter(p => p.files.some(f => files.includes(f)) || files.length === 0)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit);
    if (relevant.length === 0) return "";
    return relevant.map(p =>
      `[${p.type}|${p.antCaste}|str:${p.strength.toFixed(2)}] ${p.content}`
    ).join("\n");
  }

  // ═══ Ants ═══

  updateAnt(ant: Ant): void {
    this.withStateLock(() => {
      const state = this.readJson<ColonyState>(this.stateFile);
      const idx = state.ants.findIndex(a => a.id === ant.id);
      if (idx >= 0) state.ants[idx] = ant;
      else state.ants.push(ant);
      this.writeJson(this.stateFile, state);
    });
  }

  // ═══ Concurrency Sampling ═══

  recordSample(sample: ConcurrencySample): void {
    this.withStateLock(() => {
      const state = this.readJson<ColonyState>(this.stateFile);
      state.concurrency.history.push(sample);
      if (state.concurrency.history.length > 30) {
        state.concurrency.history = state.concurrency.history.slice(-30);
      }
      this.writeJson(this.stateFile, state);
    });
  }

  // ═══ Cleanup ═══

  destroy(): void {
    try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  // ═══ Internal ═══

  private withStateLock<T>(fn: () => T): T {
    const MAX_WAIT = 5000;
    const SPIN_MS = 15;
    const start = Date.now();
    while (true) {
      try {
        fs.writeFileSync(this.lockFile, `${process.pid}`, { flag: "wx" });
        break;
      } catch {
        if (Date.now() - start > MAX_WAIT) {
          // 超时：检查锁持有者是否存活
          try {
            const holder = parseInt(fs.readFileSync(this.lockFile, "utf-8"), 10);
            try { process.kill(holder, 0); } catch { /* 进程已死，清除死锁 */ fs.unlinkSync(this.lockFile); continue; }
          } catch { /* 读取失败，强制清除 */ try { fs.unlinkSync(this.lockFile); } catch {} }
          continue;
        }
        // 简单 busy-wait，避免 SharedArrayBuffer 依赖
        const until = Date.now() + SPIN_MS + Math.random() * SPIN_MS;
        while (Date.now() < until) { /* spin */ }
      }
    }
    try {
      return fn();
    } finally {
      try { fs.unlinkSync(this.lockFile); } catch { /* lock already removed */ }
    }
  }

  private writeJson(file: string, data: unknown): void {
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file); // 原子写入
  }

  private readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  }
}
