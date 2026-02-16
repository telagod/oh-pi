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
  private stateCache: ColonyState | null = null;

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
    this.stateCache = state;
    this.taskCache.clear();
    for (const t of state.tasks) this.writeTask(t);
  }

  getState(): ColonyState {
    if (!this.stateCache) {
      this.stateCache = this.readJson<ColonyState>(this.stateFile);
    }
    const base = { ...this.stateCache };
    base.tasks = this.getAllTasks();
    base.pheromones = this.getAllPheromones();
    return base;
  }

  updateState(patch: Partial<Pick<ColonyState, "status" | "concurrency" | "metrics" | "ants" | "finishedAt">>): void {
    this.withStateLock(() => {
      if (!this.stateCache) {
        this.stateCache = this.readJson<ColonyState>(this.stateFile);
      }
      Object.assign(this.stateCache, patch);
      this.writeJson(this.stateFile, this.stateCache);
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

  /** 获取下一个可领取的任务（按优先级 + 信息素强度 - repellent负信息素排序，ε-greedy 随机觅食） */
  nextPendingTask(caste: "scout" | "worker" | "soldier"): Task | null {
    const tasks = this.getAllTasks()
      .filter(t => t.status === "pending" && t.caste === caste);
    if (tasks.length === 0) return null;

    // ε-greedy：10% 概率随机选任务，避免蚂蚁全挤同一条路
    if (tasks.length > 1 && Math.random() < 0.1) {
      return tasks[Math.floor(Math.random() * tasks.length)];
    }

    // 信息素加权：discovery/completion 加分，warning/repellent 减分（负信息素）
    const pheromones = this.getAllPheromones();
    const scored = tasks.map(t => {
      let pScore = 0;
      for (const p of pheromones) {
        if (!p.files.some(f => t.files.includes(f)) || p.strength <= 0.1) continue;
        if (p.type === "discovery" || p.type === "completion") pScore += p.strength;
        else if (p.type === "repellent") pScore -= p.strength * 3;  // repellent 负信息素惩罚最重
        else if (p.type === "warning") pScore -= p.strength;
      }
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
      if (!this.stateCache) {
        this.stateCache = this.readJson<ColonyState>(this.stateFile);
      }
      const idx = this.stateCache.ants.findIndex(a => a.id === ant.id);
      if (idx >= 0) this.stateCache.ants[idx] = ant;
      else this.stateCache.ants.push(ant);
      this.writeJson(this.stateFile, this.stateCache);
    });
  }

  // ═══ Concurrency Sampling ═══

  recordSample(sample: ConcurrencySample): void {
    this.withStateLock(() => {
      if (!this.stateCache) {
        this.stateCache = this.readJson<ColonyState>(this.stateFile);
      }
      this.stateCache.concurrency.history.push(sample);
      if (this.stateCache.concurrency.history.length > 30) {
        this.stateCache.concurrency.history = this.stateCache.concurrency.history.slice(-30);
      }
      this.writeJson(this.stateFile, this.stateCache);
    });
  }

  // ═══ Cleanup ═══

  destroy(): void {
    try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  // ═══ Internal ═══

  private withStateLock<T>(fn: () => T): T {
    const MAX_WAIT = 3000;
    const SPIN_MS = 1;
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

  /** 查找可恢复的蚁群（状态为 working/scouting/reviewing 且未完成） */
  static findResumable(cwd: string): { colonyId: string; state: ColonyState } | null {
    const parentDir = path.join(cwd, ".ant-colony");
    try {
      for (const dir of fs.readdirSync(parentDir)) {
        const stateFile = path.join(parentDir, dir, "state.json");
        if (!fs.existsSync(stateFile)) continue;
        const state = JSON.parse(fs.readFileSync(stateFile, "utf-8")) as ColonyState;
        if (!state.finishedAt && state.status !== "done" && state.status !== "failed" && state.status !== "budget_exceeded") {
          return { colonyId: dir, state };
        }
      }
    } catch { /* no .ant-colony dir */ }
    return null;
  }

  /** 从已有文件恢复，不调用 init */
  restore(): void {
    this.stateCache = this.readJson<ColonyState>(this.stateFile);
    // 将 claimed/active 任务重置为 pending（蚂蚁已死）
    for (const task of this.getAllTasks()) {
      if (task.status === "claimed" || task.status === "active") {
        task.status = "pending";
        task.claimedBy = undefined;
        this.writeTask(task);
      }
    }
  }
}
