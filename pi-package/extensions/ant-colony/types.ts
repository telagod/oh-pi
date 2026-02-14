/**
 * 蚁群类型系统 — 映射真实蚁群生态
 */

// ═══ 蚂蚁角色 ═══
export type AntCaste = "scout" | "worker" | "soldier";

export interface AntConfig {
  caste: AntCaste;
  model: string;
  tools: string[];
  systemPrompt: string;
  maxTurns: number;
}

export const DEFAULT_ANT_CONFIGS: Record<AntCaste, Omit<AntConfig, "systemPrompt">> = {
  scout:   { caste: "scout",   model: "claude-haiku-4-5",   tools: ["read", "bash", "grep", "find", "ls"], maxTurns: 5 },
  worker:  { caste: "worker",  model: "claude-sonnet-4-5",  tools: ["read", "bash", "edit", "write", "grep", "find", "ls"], maxTurns: 15 },
  soldier: { caste: "soldier", model: "claude-sonnet-4-5",  tools: ["read", "bash", "grep", "find", "ls"], maxTurns: 8 },
};

// ═══ 任务 (Food Source) ═══
export type TaskStatus = "pending" | "claimed" | "active" | "done" | "failed" | "blocked";
export type TaskPriority = 1 | 2 | 3 | 4 | 5; // 1=highest

export interface Task {
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  caste: AntCaste;           // 哪种蚂蚁该做
  status: TaskStatus;
  priority: TaskPriority;
  files: string[];           // 锁定的文件
  claimedBy: string | null;  // ant id
  result: string | null;
  error: string | null;
  spawnedTasks: string[];    // 子任务 id
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

// ═══ 信息素 ═══
export type PheromoneType =
  | "discovery"    // 侦察蚁发现的信息
  | "progress"     // 工蚁进度
  | "warning"      // 危险标记（失败、冲突）
  | "completion"   // 完成标记
  | "dependency";  // 依赖关系

export interface Pheromone {
  id: string;
  type: PheromoneType;
  antId: string;
  antCaste: AntCaste;
  taskId: string;
  content: string;
  files: string[];
  strength: number;    // 0-1, 随时间挥发
  createdAt: number;
}

// ═══ 蚂蚁实例 ═══
export type AntStatus = "idle" | "working" | "done" | "failed";

export interface Ant {
  id: string;
  caste: AntCaste;
  status: AntStatus;
  taskId: string | null;
  pid: number | null;
  usage: { input: number; output: number; cost: number; turns: number };
  startedAt: number;
  finishedAt: number | null;
}

// ═══ 蚁巢状态 ═══
export interface ColonyState {
  id: string;
  goal: string;
  status: "scouting" | "working" | "reviewing" | "done" | "failed";
  tasks: Task[];
  ants: Ant[];
  pheromones: Pheromone[];
  concurrency: ConcurrencyConfig;
  metrics: ColonyMetrics;
  createdAt: number;
  finishedAt: number | null;
}

export interface ConcurrencyConfig {
  current: number;
  min: number;
  max: number;
  optimal: number;       // 自适应计算的最优值
  history: ConcurrencySample[];
}

export interface ConcurrencySample {
  timestamp: number;
  concurrency: number;
  cpuLoad: number;
  memFree: number;
  throughput: number;    // tasks completed per minute
}

export interface ColonyMetrics {
  tasksTotal: number;
  tasksDone: number;
  tasksFailed: number;
  antsSpawned: number;
  totalCost: number;
  totalTokens: number;
  startTime: number;
  throughputHistory: number[];  // tasks/min 滑动窗口
}
