/**
 * 蚁群类型系统 — 映射真实蚁群生态
 */

export type AntCaste = "scout" | "worker" | "soldier" | "drone";

export interface AntConfig {
  caste: AntCaste;
  model: string;
  tools: string[];
  systemPrompt: string;
  maxTurns: number;
}

export const DEFAULT_ANT_CONFIGS: Record<AntCaste, Omit<AntConfig, "systemPrompt">> = {
  scout:   { caste: "scout",   model: "",  tools: ["read", "bash", "grep", "find", "ls"], maxTurns: 8 },
  worker:  { caste: "worker",  model: "",  tools: ["read", "bash", "edit", "write", "grep", "find", "ls"], maxTurns: 15 },
  soldier: { caste: "soldier", model: "",  tools: ["read", "bash", "grep", "find", "ls"], maxTurns: 8 },
  drone:   { caste: "drone",   model: "",  tools: ["bash"], maxTurns: 1 },
};

export type ModelOverrides = Partial<Record<AntCaste, string>>;

export type TaskStatus = "pending" | "claimed" | "active" | "done" | "failed" | "blocked";
export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export interface Task {
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  caste: AntCaste;
  status: TaskStatus;
  priority: TaskPriority;
  files: string[];
  context?: string;
  claimedBy: string | null;
  result: string | null;
  error: string | null;
  spawnedTasks: string[];
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export type PheromoneType =
  | "discovery"
  | "progress"
  | "warning"
  | "completion"
  | "dependency"
  | "repellent";

export interface Pheromone {
  id: string;
  type: PheromoneType;
  antId: string;
  antCaste: AntCaste;
  taskId: string;
  content: string;
  files: string[];
  strength: number;
  createdAt: number;
}

export type AntStatus = "idle" | "working" | "done" | "failed";

export interface Ant {
  id: string;
  caste: AntCaste;
  status: AntStatus;
  taskId: string | null;
  pid: number | null;
  model: string;
  usage: { input: number; output: number; cost: number; turns: number };
  startedAt: number;
  finishedAt: number | null;
}

export interface AntStreamEvent {
  antId: string;
  caste: AntCaste;
  taskId: string;
  delta: string;
  totalText: string;
}

export interface ColonyState {
  id: string;
  goal: string;
  status: "scouting" | "planning_recovery" | "working" | "reviewing" | "done" | "failed" | "budget_exceeded";
  tasks: Task[];
  ants: Ant[];
  pheromones: Pheromone[];
  concurrency: ConcurrencyConfig;
  metrics: ColonyMetrics;
  maxCost: number | null;
  modelOverrides: ModelOverrides;
  createdAt: number;
  finishedAt: number | null;
}

export interface ConcurrencyConfig {
  current: number;
  min: number;
  max: number;
  optimal: number;
  history: ConcurrencySample[];
  lastRateLimitAt?: number;
}

export interface ConcurrencySample {
  timestamp: number;
  concurrency: number;
  cpuLoad: number;
  memFree: number;
  throughput: number;
}

export interface ColonyMetrics {
  tasksTotal: number;
  tasksDone: number;
  tasksFailed: number;
  antsSpawned: number;
  totalCost: number;
  totalTokens: number;
  startTime: number;
  throughputHistory: number[];
}

export interface ColonySignal {
  phase: ColonyState["status"];
  progress: number;
  active: number;
  cost: number;
  message: string;
}
