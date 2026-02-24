# PiAdapter 接口草案（Phase C 起步）

> 目标：在 `spawner.ts` 与 pi SDK 之间引入反腐层（anti-corruption layer），统一会话创建、Tool 注入、流式回调与中断/超时处理，隔离 SDK 变更影响。

## 1. 设计目标

- **边界收敛**：将零散 SDK 调用集中到 `PiAdapter`，避免业务层直接依赖底层 API 细节。
- **升级隔离**：SDK 升级时，优先在适配层消化差异，不把变更扩散到调度与任务编排逻辑。
- **行为保持**：仅约束调用边界，不改变现有 queen/spawner 的业务语义与任务流。
- **可测试**：通过接口注入 mock/fake，便于对超时、取消、流式事件进行可重复测试。

## 2. 接口草案（TypeScript）

```ts
export type PiRole = "system" | "user" | "assistant";

export interface PiMessage {
  role: PiRole;
  content: string;
}

export interface PiToolSpec {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface CreateSessionOptions {
  model?: string;
  instructions?: string;
  metadata?: Record<string, string>;
  timeoutMs?: number;
}

export interface RunOptions {
  tools?: PiToolSpec[];
  timeoutMs?: number;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  onEvent?: (event: { type: string; data?: unknown }) => void;
}

export interface PiRunResult {
  outputText: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  };
  raw?: unknown;
}

export interface PiSession {
  id: string;
  run(messages: PiMessage[], options?: RunOptions): Promise<PiRunResult>;
  interrupt(reason?: string): Promise<void>;
  close(): Promise<void>;
}

export interface PiAdapter {
  createSession(options?: CreateSessionOptions): Promise<PiSession>;
}
```

### 2.1 能力映射说明

- **会话创建**：`createSession` 统一封装模型、初始指令、metadata 与默认超时。
- **Tool 注入**：`RunOptions.tools` 作为唯一入口，业务层不直接拼接 SDK 特定字段。
- **流式回调**：`onToken`/`onEvent` 对上层暴露稳定事件模型。
- **中断/超时**：`AbortSignal` + `timeoutMs` + `interrupt()` 统一取消语义。

## 3. 迁移步骤（先文档后代码）

### Step 1：接口落地（不改行为）

- 新增 `PiAdapter` 类型定义与默认实现占位。
- `spawner.ts` 仍维持现状逻辑，仅准备依赖注入点。

### Step 2：调用收口（最小改动）

- 将 `spawner.ts` 中会话创建、调用、流式处理迁移到 `PiAdapter`。
- 保持输入输出结构不变，确保现有流程回归通过。

### Step 3：超时/中断统一化

- 将分散的超时与取消处理改为适配层统一策略。
- 补充异常分类（超时、用户取消、SDK 错误）并保持上层错误语义稳定。

### Step 4：升级演练与回滚

- 在不改调度逻辑的前提下演练一次 SDK 升级。
- 若异常，允许临时切回旧调用路径（短期开关），再迭代适配层。

## 4. 非目标（当前阶段）

- 不重写 queen/spawner 的调度策略。
- 不引入新的业务状态机或任务分配规则。
- 不在本阶段改动 benchmark 与评估口径。
