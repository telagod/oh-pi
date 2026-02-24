# Ant Colony 重启容错检查文档

## 关键目录

根据当前仓库实现与运行态样本，重启容错依赖如下目录与文件：

- 运行态持久化目录：`.ant-colony/{colony-id}/`
  - `state.json`：记录阶段状态、当前目标、并发历史等。
  - `tasks/*.json`：记录任务定义、状态与结果。
- 文档机制说明：`pi-package/extensions/ant-colony/README.md:83-89` 明确描述了 `state.json / pheromone.jsonl / tasks/*.json` 的巢穴结构。
- 持久化目录纳入忽略规则：`pi-package/extensions/ant-colony/index.ts:25-31` 在启动时确保 `.ant-colony/` 被写入 `.gitignore`，避免运行态文件污染版本库。

运行态样本观察（真实数据）：

- `.ant-colony/colony-mm00vmnq/state.json:3-4` 显示当前目标与 `planning_recovery` 状态。
- `.ant-colony/colony-mm00vmnq/state.json:91-119` 显示并发历史采样，证明运行态指标会被持续落盘。
- `.ant-colony/colony-mm00vmnq/tasks/t-mm00vmnq-smef.json:4-11` 显示任务内容与结果持久化。

## 恢复机制观察

### 1) 会话重启后的监听器恢复

- `pi-package/extensions/ant-colony/index.ts:65-74`：在 `session_start` 时移除旧监听器并重新绑定，直接针对 `/reload` 后旧 `ctx` 失效问题，避免重启后事件链断裂。

### 2) 并发容错与 429 恢复

- `pi-package/extensions/ant-colony/concurrency.ts:61-65`：当无待处理任务时，将并发降至最小值，避免空转放大风险。
- `pi-package/extensions/ant-colony/concurrency.ts:83-85`：触发 429 后进入 30 秒冷却窗口，不立即提升并发。
- `pi-package/extensions/ant-colony/concurrency.ts:120-123`：冷却结束后执行“429 recovery”，并发恢复到 `optimal`。

### 3) 任务冲突后的可恢复状态

- `pi-package/extensions/ant-colony/README.md:78`：冲突任务进入 `blocked`，待锁释放后可继续，体现异常路径下的可恢复设计。

### 4) 任务编排输入约束（避免 no_pending_worker_tasks）

- `pi-package/extensions/ant-colony/parser.test.ts:85-96`：中文 TASK 结构（`任务/描述/文件/角色/优先级`，含全角冒号）可被解析。
- `pi-package/extensions/ant-colony/parser.test.ts:99-105`：纯“下一步叙述”不会生成任务，说明恢复流程必须继续输出结构化 TASK 块。

## 结论

基于代码、README 与 `.ant-colony` 运行态样本三类证据，可以确认该扩展具备重启容错闭环：

1. **状态可落盘**：`state.json + tasks/*.json` 持久化关键执行状态与任务结果；
2. **重启可续接**：`session_start` 重新绑定监听器，修复 `/reload` 后上下文失效风险；
3. **故障可回稳**：并发控制在空载与 429 情况下具备降载、冷却、恢复到最优值的策略；
4. **流程可调度**：只要继续使用结构化 TASK 输出，调度器可稳定识别并推进 worker 任务。

本次检查仅新增文档文件 `docs/ant-colony-restart-check.md`，未修改其他文件。
