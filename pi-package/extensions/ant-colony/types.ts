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
  scout:   { caste: "scout",   model: "",  tools: ["read", "bash", "grep", "find", "ls"], maxTurns: 5 },
  worker:  { caste: "worker",  model: "",  tools: ["read", "bash", "edit", "write", "grep", "find", "ls"], maxTurns: 15 },
  soldier: { caste: "soldier", model: "",  tools: ["read", "bash", "grep", "find", "ls"], maxTurns: 8 },
};

// ═══ 模型层级 ═══
export type ModelTier = "fast" | "balanced" | "powerful";

export const CASTE_MODEL_TIER: Record<AntCaste, ModelTier> = {
  scout: "fast",
  worker: "powerful",
  soldier: "balanced",
};

export const MODEL_TIER_KEYWORDS: Record<ModelTier, string[]> = {
  fast:     ["haiku", "mini", "flash", "nano", "small"],
  balanced: ["sonnet", "gpt-4o", "pro"],
  powerful: ["opus", "o1", "o3", "deepthink"],
};

/** Per-caste model overrides from user config */
export type ModelOverrides = Partial<Record<AntCaste, string>>;

export interface AvailableModel {
  id: string;
  cost?: { input: number };
}

/** Extract version score from model name: "claude-sonnet-4-0" → 4.0, "claude-3-5-haiku" → 3.5 */
function modelVersionScore(id: string): number {
  // Match patterns like "4-0", "3-5", "4.5", "4o" etc.
  const nums = id.match(/(\d+)[-.](\d+)/g);
  if (!nums) {
    const single = id.match(/(\d+)/g);
    return single ? Math.max(...single.map(Number)) : 0;
  }
  // Take the highest version-like number pair
  return Math.max(...nums.map(n => {
    const [a, b] = n.split(/[-.]/).map(Number);
    return a + (b ?? 0) / 10;
  }));
}

/**
 * 根据 caste 的 ModelTier 从可用模型中匹配最合适的模型
 *
 * 策略：从模型名提取版本号排序
 * - fast（侦察蚁）：选版本号最低的（轻量便宜）
 * - powerful（工蚁）：选版本号最高的（最强）
 * - balanced（兵蚁）：优先当前会话模型
 * - 所有 tier 最终 fallback 到 currentModel
 */
export function resolveModelForCaste(
  caste: AntCaste,
  available: AvailableModel[],
  currentModel?: string,
): string | undefined {
  if (available.length === 0) return currentModel;
  const tier = CASTE_MODEL_TIER[caste];

  // 工蚁/兵蚁优先使用当前会话模型
  if (tier !== "fast" && currentModel) return currentModel;

  // 按版本号排序
  const scored = available.map(m => ({ id: m.id, score: modelVersionScore(m.id) }));
  scored.sort((a, b) => a.score - b.score);

  // 优先同 provider
  const provider = currentModel?.split("/")[0] ?? currentModel?.split("-")[0];
  const sameProvider = provider ? scored.filter(m => m.id.toLowerCase().includes(provider.toLowerCase())) : [];
  const pool = sameProvider.length > 0 ? sameProvider : scored;

  if (tier === "fast") return pool[pool.length - 1]?.id ?? currentModel;
  if (tier === "powerful") return pool[pool.length - 1]?.id ?? currentModel;
  // balanced: middle
  return pool[Math.floor(pool.length / 2)]?.id ?? currentModel;
}

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
  status: "scouting" | "working" | "reviewing" | "done" | "failed" | "budget_exceeded";
  tasks: Task[];
  ants: Ant[];
  pheromones: Pheromone[];
  concurrency: ConcurrencyConfig;
  metrics: ColonyMetrics;
  maxCost: number | null;       // cost budget in USD, null = unlimited
  modelOverrides: ModelOverrides;
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
