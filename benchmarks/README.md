# Benchmarks（空框架）

本目录用于建立基准测试的**统一模板**，用于对比：

- 单 agent
- 蚁群协作（multi-agent colony）

> 当前阶段仅提供文档框架，不包含任何实现脚本。

## 目标

围绕以下维度进行对比评估：

1. 完成率（Success Rate）
2. 时长（Duration）
3. 成本（Cost）
4. 回滚率（Rollback Rate）

并按照任务复杂度分级：

- S（Small）
- M（Medium）
- L（Large）

## 文件说明

- `scenarios.md`：场景清单模板（按 S/M/L 分级）
- `results-template.md`：结果记录模板（单 agent vs 蚁群）

## 建议执行流程（手工版）

1. 在 `scenarios.md` 中挑选一个场景（含复杂度级别）。
2. 使用同一场景分别运行：
   - 单 agent
   - 蚁群协作
3. 将每次运行结果填写到 `results-template.md`。
4. 统计每个复杂度级别下的四项指标差异。

## 填写约束

- 同一场景下，尽量保持输入与验收标准一致。
- 成本口径需一致（例如都按 token / API 花费估算）。
- 回滚率需明确定义（例如“需要人工回退或重做的运行占比”）。

## 后续扩展（未来）

- 增加自动化采集脚本。
- 增加可视化报表。
- 将结果接入 CI 周期性回归。
