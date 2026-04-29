# Ant Colony for Pi：架构重构计划

> 目标：让产品定位、代码边界、分发方式三者一致。

## 1. 为什么现在要重构

产品定位已经从“pi 配置增强包”收敛为“面向复杂任务的 pi 蚁群插件”。

但代码与仓库结构仍残留旧阶段特征：

- `oh-pi` 分发层与 colony 主能力混在一起
- colony runtime 与 pi integration 耦合偏深
- `spawner` 对 pi SDK 直接依赖较重
- 状态与信息素存储边界不够清晰
- 文档、命名与工程结构还没有完全反映新定位

因此，当前最重要的不是继续堆功能，而是做一次**边界重构**。

---

## 2. 重构目标

### 2.1 产品目标
- 对外清楚表达：主产品是 **Ant Colony for Pi**
- `oh-pi` 仅作为现阶段 bootstrap / 分发入口存在

### 2.2 工程目标
- 让 colony 成为更标准的 pi extension / plugin
- 限制上游 pi SDK 变化的影响面
- 为 benchmark、可视化、状态回放、后续存储替换打基础

### 2.3 维护目标
- 新功能主要落在 colony core，而不是散落在 bootstrap 层
- SDK 升级问题优先在适配层解决
- 未来可按包拆分而不需要大规模重写

---

## 3. 核心分层

建议把系统拆成三层：

```txt
┌─────────────────────────────────────┐
│ Bootstrap / Distribution            │
│ - npx oh-pi                         │
│ - 安装/初始化/资源写入              │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ Pi Integration Layer                │
│ - tool 注册                         │
│ - slash commands                    │
│ - widget / signals / status UI      │
│ - 与 pi extension API 对接          │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ Colony Core                         │
│ - queen / planning                  │
│ - task decomposition                │
│ - worker / reviewer lifecycle       │
│ - pheromone logic                   │
│ - concurrency policy                │
│ - recovery / retry semantics        │
└─────────────────────────────────────┘
```

原则：
- **越往下越少知道 pi 细节**
- **越往上越少知道 colony 内部策略**

---

## 4. 第一优先级边界

### 4.1 `PiAdapter`

目的：在 colony 与 pi SDK 之间建立反腐层（anti-corruption layer）。

应统一封装：
- session 创建
- 模型选择 / metadata
- tool 注入
- token / event 流式回调
- timeout / interrupt / abort
- 错误分类

预期效果：
- SDK 升级时主要改 adapter
- `spawner` 不再散落底层 API 细节
- 便于 mock / fake 做测试

参考文档：
- [`docs/PI-ADAPTER.md`](./PI-ADAPTER.md)

### 4.2 `PheromoneStore`

目的：把信息素存储从 queen/nest 逻辑中抽出来。

建议接口能力：
- append / read / decay
- 按任务、文件、角色读取权重
- 支持成功/失败/警告等不同信号
- 可插拔实现（JSONL → SQLite）

预期效果：
- 状态更可观测
- 可做回放、统计、调试
- 可做未来扩散/强化策略实验

### 4.3 Runtime / Integration 分离

目的：让 colony 核心逻辑不直接承担 UI 与宿主接入责任。

Core 负责：
- 任务状态机
- 调度
- 锁与依赖
- 审查与恢复

Integration 负责：
- status widget
- signals
- 命令入口
- 用户交互动作

预期效果：
- UI 重做不会动核心调度
- 可支持不同呈现层
- 更接近标准插件形态

---

## 5. 建议阶段

### Phase 1：文档与命名对齐
- README 切换为 colony-first
- 补产品边界文档
- 明确 `oh-pi` = bootstrap, `ant-colony` = primary capability

### Phase 2：适配层收口
- 引入 `PiAdapter`
- 将 `spawner` 的 SDK 调用迁移到 adapter
- 增加 smoke tests 与 fake session tests

### Phase 3：状态与存储抽象
- 提取 `PheromoneStore`
- 视需要扩展 TaskState / RunState store
- 保持默认 JSONL 实现，补可替换边界

### Phase 4：runtime / integration 分层
- 把 widget、signals、commands 从核心调度剥离
- 让 colony core 以更纯粹接口暴露运行状态

### Phase 5：结构拆包（可选）
理想未来结构：

```txt
packages/
  ant-colony-core/
  ant-colony-pi/
  ant-colony-bench/
  oh-pi-bootstrap/
```

短期不一定立刻拆仓库，但设计上要先按这个方向约束依赖。

---

## 6. 目录层面的建议落点

如果短期仍保持单仓库，可先逻辑拆分：

```txt
src/
  bootstrap/
  colony-core/
  colony-pi/
```

### `bootstrap/`
负责：
- 安装引导
- 配置写入
- 资源分发

### `colony-core/`
负责：
- queen
- nest
- concurrency
- deps
- types
- recovery

### `colony-pi/`
负责：
- adapter
- extension 注册
- UI / widgets / signals
- slash commands

---

## 7. 成功判据

重构完成后，应该能回答这些问题：

### 产品层
- 新用户 10 秒内能否看懂这是 pi 的蚁群插件？
- 用户能否快速判断任务是否适合 colony？

### 工程层
- pi SDK 升级时，是否主要只改 `PiAdapter`？
- 状态存储替换时，是否不改 queen 主流程？
- UI 调整时，是否不影响核心调度？

### 增长层
- 是否可以做更可信的 benchmark？
- 是否可以更清楚地展示 colony 何时有效、何时不该启用？

---

## 8. 当前不追求的事情

在边界尚未稳定前，不优先追求：

- 更多主题/预设/技能打包
- 分布式 colony
- 复杂商业化功能
- 为所有小任务强行自动启用 colony
- 先讲仿生概念、后讲实际收益

---

## 9. 结论

这次重构不是“技术洁癖”，而是产品收敛后的必需动作。

如果产品已经决定：
- **主打蚁群插件**
- **弱化配置合集叙事**

那么工程上就必须同步做到：
- colony core 更独立
- pi integration 更明确
- bootstrap 层更轻

否则产品定位、仓库结构与代码边界会继续互相拉扯。
