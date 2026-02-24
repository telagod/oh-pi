# PLAN: 定位收敛 + 架构降风险（2026 Q1）

> 目标：针对当前最关键的 6 个问题（定位、存储、SDK 耦合、Demo、Benchmark、增长）给出可执行计划。

## 0. 问题映射（来自当前复盘）

1. **定位模糊**：oh-pi（配置入口）与 ant-colony（高级多智能体）边界不够清晰。  
2. **存储天花板**：信息素依赖本地 JSONL，扩展到长会话/多实例会遇到瓶颈。  
3. **SDK 耦合风险**：`spawner` 对 pi SDK 直接依赖过深，上游 breaking change 风险高。  
4. **缺少“哇”时刻**：文档完善，但用户首次体验缺一个强示例闭环。  
5. **缺少硬证据**：单 agent vs 蚁群的收益边界缺少可复现实验数据。  
6. **增长分散**：多语言铺开早于社区聚焦，反馈密度不足。

---

## 1. 执行原则

- **先窄后宽**：先把入口体验打磨清楚，再放大蚁群叙事。  
- **先证据后扩张**：没有 benchmark 数据，不扩大“蚁群优于单 agent”的宣传。  
- **接口先行**：对存储层和 SDK 层先抽象，再做实现替换。  
- **每两周可验收**：每个里程碑必须有可交付物 + 指标。

---

## 2. 8 周分阶段计划

## Phase A（Week 1-2）：定位与体验入口

### 交付物
- [ ] README 首屏统一为三段：30 秒上手 / 2 分钟价值 / 不适用场景（中英法）
- [ ] 发布 2 分钟演示（asciinema + GIF + 文本脚本）
- [ ] 在 README 增加「oh-pi vs ant-colony」边界图

### DoD
- 新用户 3 分钟内可完成：安装 → 配置 → 首次有效运行
- 至少 5 名外部开发者复现 Demo（非维护者）

### 关键指标
- Activation：首次运行成功率
- TTV（time-to-value）：从 `npx oh-pi` 到第一次可用输出的中位时间

---

## Phase B（Week 3-4）：信息素层抽象（解决 JSONL 单点）

### 交付物
- [ ] 定义 `PheromoneStore` 接口：
  - `append(pheromone)`
  - `queryByFiles(files, options)`
  - `evict(policy)`
  - `stats()`
- [ ] 将现有 JSONL 改为 `JsonlPheromoneStore` 默认实现
- [ ] 衰减策略配置化：
  - 全局半衰期（默认 10 分钟）
  - 按任务类型覆盖（scout/worker/soldier）
- [ ] 提供 `SqlitePheromoneStore`（实验性）

### DoD
- 在不改 queen 调度逻辑的情况下可切换存储实现
- 长会话（>10k 条信息素）读写性能可接受且无数据损坏

### 风险控制
- 先保留 JSONL 为默认，SQLite 通过 feature flag 启用

---

## Phase C（Week 5-6）：pi SDK 反腐层（解决 spawner 耦合）

### 交付物
- [ ] 新增 `PiAdapter`（anti-corruption layer）
  - Session 创建
  - Tool 注入
  - 流式回调
  - 中断/超时处理
- [ ] `spawner.ts` 改为依赖 `PiAdapter`，不再直接散落 SDK API
- [ ] 增加 SDK 兼容 smoke tests（至少覆盖当前 + 上一个次版本）

### DoD
- 上游 SDK 升级时，改动范围主要限制在适配层
- spawner 复杂度下降（导入项和直接 SDK 调用显著减少）

---

## Phase D（Week 7-8）：证据与增长

### 交付物
- [ ] 发布 benchmark 套件：
  - 任务复杂度分级（S/M/L）
  - 单 agent vs 蚁群（完成率/时长/成本/回滚率）
- [ ] 发布结果报告 + 可复现脚本
- [ ] 社区聚焦执行（中文开发者社区为主）
  - 固定节奏：每周 1 篇实战帖 + 1 个短演示

### DoD
- 至少 1 份公开 benchmark 结果可由第三方复现
- 至少 1 个社区渠道形成稳定反馈循环（问题 -> 迭代 -> 回访）

---

## 3. 版本对齐建议

- **v0.1.76**：README 首屏三语同步 + Demo 资产上线
- **v0.1.77**：`PheromoneStore` 抽象 + JSONL 实现迁移
- **v0.1.78**：可配置衰减 + SQLite 实验实现
- **v0.1.79**：`PiAdapter` 落地 + spawner 解耦
- **v0.1.80**：benchmark 报告 + 增长实验总结

---

## 4. 立刻执行（本周）

- [x] 补齐 `README.fr.md` 首屏与中英一致（定位统一）
- [ ] 产出 2 分钟 asciinema（含字幕版）
- [ ] 建立 `benchmarks/` 目录与任务模板（先空框架）
- [x] 起草 `PheromoneStore` 接口草案（见 `docs/PHEROMONE-STORE.md`）

---

## 5. 成功标准（8 周后）

- 用户能在 3 分钟内理解并完成首次有效使用
- 蚁群能力有可复现实验数据支持，不靠叙事说服
- 上游 SDK 变更不再“直击核心调度”
- 架构复杂度可控（入口体验与高级能力边界清晰）
