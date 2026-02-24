# PheromoneStore 接口草案（Phase B 起步）

> 目标：将信息素读写从 `nest.ts` 的 JSONL 细节中抽离，先定义稳定接口，再逐步实现 Jsonl/SQLite 可替换存储。

## 1. 设计目标

- **可替换**：默认 JSONL，不改 queen 调度逻辑即可切换实现。
- **可观测**：能拿到存储规模、衰减后有效条目、写入失败等统计。
- **可配置**：支持全局与按任务类型（scout/worker/soldier）衰减策略。
- **可渐进迁移**：先适配现有行为，再引入 SQLite/Redis（后续）。

## 2. 非目标（当前阶段）

- 不做分布式一致性保证。
- 不做跨机器共享锁。
- 不改变现有任务调度与优先级算法。

## 3. 建议接口（TypeScript）

```ts
export interface DecayPolicy {
  // 默认半衰期（毫秒），例如 10 * 60 * 1000
  defaultHalfLifeMs: number;
  // 可选：按角色覆盖
  perCasteHalfLifeMs?: Partial<Record<"scout" | "worker" | "soldier" | "drone", number>>;
  // 强度阈值，低于阈值视为过期
  minStrength?: number; // default: 0.05
}

export interface PheromoneQuery {
  files?: string[];
  types?: Array<"discovery" | "progress" | "warning" | "completion" | "dependency" | "repellent">;
  limit?: number;
  includeDecayed?: boolean;
}

export interface PheromoneStoreStats {
  totalStored: number;
  totalActive: number;
  lastCompactionAt: number | null;
  storageBytes: number;
}

export interface PheromoneStore {
  append(entry: import("./types.js").Pheromone): Promise<void>;
  query(q?: PheromoneQuery): Promise<import("./types.js").Pheromone[]>;
  compact(now?: number): Promise<void>;
  setDecayPolicy(policy: DecayPolicy): Promise<void>;
  getStats(): Promise<PheromoneStoreStats>;
  close(): Promise<void>;
}
```

## 4. 与现有 Nest 行为映射

当前 `nest.ts` 中信息素相关职责：
- `dropPheromone`：追加写入 JSONL
- `getAllPheromones`：增量读取 + 衰减 + 过滤 + 定期 GC
- `countWarnings/getPheromoneContext`：查询视图

迁移策略：
1. 保留 `Nest` 对外方法不变。
2. 将 JSONL 细节下沉到 `JsonlPheromoneStore`。
3. `Nest` 只依赖 `PheromoneStore` 接口。

## 5. 迁移步骤（建议）

### Step 1：接口引入（不改行为）
- 新建 `pi-package/extensions/ant-colony/pheromone-store.ts`（仅类型 + 工厂）。
- 现有逻辑先继续在 `nest.ts`，但通过适配层调用。

### Step 2：JSONL 默认实现
- 提取 `nest.ts` 现有 JSONL 读写逻辑到 `jsonl-pheromone-store.ts`。
- 保持现有半衰期与阈值默认值，确保回归测试通过。

### Step 3：SQLite 实验实现
- 新增 `sqlite-pheromone-store.ts`（feature flag 启用）。
- 对比同任务集下：读取延迟、文件体积、GC 耗时。

## 6. 验收标准（Phase B）

- 切换存储实现不影响 queen 调度结果。
- 回归测试中 `planning_recovery` 流程行为一致。
- 长会话（高频写入）下无数据损坏与明显性能退化。

## 7. 风险与回滚

- 风险：接口抽象不完整导致 `Nest` 泄漏实现细节。
- 回滚策略：保留 JSONL 旧路径开关（`PHEROMONE_STORE=jsonl-legacy`）在一段过渡期内可快速切回。
