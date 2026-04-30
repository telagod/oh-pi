# Ant Colony for Pi 路线图（2026 H1）

> 当前判断：最大风险仍然是**定位漂移**，不是功能不够多。

## 1) 产品定位（已收敛）

### 主定位
- **Ant Colony for Pi**：主产品。一个面向复杂编码任务的多智能体协作插件。
- **oh-pi**：当前分发/引导入口。负责安装、初始化与启用 colony，逐步降级为 bootstrap 层。

### 对外表达原则
1. 先讲「什么任务需要蚁群」
2. 再讲「蚁群如何提升复杂任务执行能力」
3. 然后讲「如何接入 pi」
4. 最后才讲仿生架构与实现细节

### 核心价值陈述
- 我们卖的不是“更多配置项”
- 我们卖的是：
  - 复杂任务拆解能力
  - 多文件任务吞吐能力
  - 并行执行能力
  - 执行后审查与恢复能力

---

## 2) 近期里程碑

> 当前快照（2026-04-30）：v0.1.85 处于 **Beta / Preview**。产品叙事与主体插件架构已基本落位；下一阶段重点是继续收紧 Pi SDK 边界与补证据型 benchmark。

### M1（1~2 周）：完成定位切换
- [x] README/文档首页重写为“蚁群插件优先”叙事
- [x] 新增 `docs/PRODUCT.md`，明确适用场景、非目标、用户边界
- [x] 将 installer / theme / preset / skills 从主卖点降级为辅助信息
- [x] 发布 2 分钟演示：单 agent 吃力 → colony 接管

**成功指标**
- 新访客能在 10 秒内理解“这是 pi 的蚁群插件”
- 新访客能快速判断“这是否适合我的任务”

### M2（2~4 周）：插件边界稳定化
- [x] 引入 `PiAdapter`（anti-corruption layer）
- [x] `spawner` 仅依赖适配层，不再散落 SDK 调用
  - 进展：session 创建 / prompt / stream / abort / dispose、tool 创建、event 翻译已通过 `AntRuntimeAdapter` 边界承载。
  - 进展：`runtime-integration.test.ts` 覆盖 `runSyncColony` → `createDefaultPiAdapter` → SDK-backed session 的宿主形态 smoke。
- [x] 将 colony runtime 与 pi UI/integration 分层
- [x] 增加 SDK 兼容性 smoke tests
  - 进展：已有 `architecture-compat.test.ts` 覆盖兼容 wrapper 转发；`adapter.test.ts` 覆盖 provider/model registry resolution 与 Pi SDK event shape → `AntRuntimeEvent` 翻译；`spawner.test.ts` 覆盖 AbortSignal → runtime session abort / dispose；`runtime-integration.test.ts` 覆盖宿主入口下的 registry resolution、session lifecycle、cancellation propagation。
  - 后续：有真实 Pi SDK fixture / host harness 后，再补一颗外部 opt-in smoke，不放进默认 CI。

**成功指标**
- 上游 SDK 小版本升级后，修复范围主要限制在适配层
- colony 核心逻辑与 pi 宿主集成边界清晰

### M3（4~6 周）：状态与存储抽象
- [x] 抽象 `PheromoneStore` 接口（JSONL 默认实现）
- [ ] 进一步抽象 run state / task state 存储边界
- [ ] 信息素衰减策略改为可配置
- [ ] 加入 SQLite 实现（可选）

**成功指标**
- 存储层切换不影响 queen/nest 主流程
- 长会话下状态文件增长可控
- 为后续可视化、回放、调试留出基础设施接口

### M4（6~8 周）：证据驱动增长
- [ ] 发布 benchmark：单 agent vs colony（按任务复杂度分层）
- [ ] 公开评测方法、失败分类与复现实验脚本
- [ ] 输出“何时收益 / 何时不收益”的明确边界图
- [ ] 社区聚焦中文开发者圈层，先打透一层真实用户

**成功指标**
- 有可复现数据证明 colony 的收益边界
- 用户能基于证据而非概念判断是否启用 colony

---

## 3) 非目标（当前阶段不做）
- 不把产品继续扩展为“大而全的 pi 配置合集”
- 不优先做分布式蚁群集群
- 不优先扩展过多语言社区运营
- 不优先引入复杂商业化功能
- 不优先为所有小任务强行启用蚁群

---

## 4) 发布节奏
- 小步快跑：每周 docs / positioning / demo 小版本
- 能力发布：按里程碑输出 feature release
- 每个版本都必须包含：
  - 适用场景
  - 不适用场景
  - 对比单 agent 的收益证据
