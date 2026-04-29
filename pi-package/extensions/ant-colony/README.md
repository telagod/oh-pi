# 🐜 Ant Colony for Pi — 蚁群多Agent协同扩展

> **Beta**：面向复杂编码任务的 Pi 多智能体插件。真实蚁群生态映射的自组织执行系统，自适应并发，信息素通信，零中心化调度。

## 架构

```
蚁后 (Queen)                    主 pi 进程，接收目标，调度生命周期
  │
  ├─ 🔍 侦察蚁 (Scout)          轻量 haiku，探路，标记食物
  ├─ ⚒️  工蚁 (Worker)           sonnet，执行任务，可产生子任务
  └─ 🛡️ 兵蚁 (Soldier)          sonnet，审查质量，可要求返工
  
信息素 (Pheromone)              .ant-colony/ 文件系统，蚂蚁间间接通信
巢穴 (Nest)                    共享状态，原子文件操作，跨进程安全
```

## 生命周期

```
目标 → 侦察 → 任务池 → 工蚁并行执行 → 兵蚁审查 → 修复(如需) → 完成
         │                    │
         │  信息素挥发(10min半衰期)  │  子任务自动产生
         └────────────────────┘
```

## 自适应并发

模拟真实蚁群的动态招募机制：

- **冷启动**：1-2 只蚂蚁，逐步探索
- **探索期**：每次 +1，监测吞吐量拐点
- **稳态期**：围绕最优值微调
- **过载保护**：CPU > 85% 或内存 < 500MB 自动减少
- **弹性伸缩**：任务多→招募，任务少→收缩

## 发布状态

当前推荐定位：**Beta / Preview**。

这表示：
- 主体架构已经落位（`core/` + `pi/` + thin entry）
- 核心交互流已可用
- 兼容 wrapper 已保留
- 仍不建议宣称为 1.0 / GA 稳定 API

## 使用方式

LLM 在判断任务复杂度足够时会自动调用 `ant_colony` tool，无需手动触发。

### 命令与控制

```
/colony-status              查看当前蚁群进度
/colony-stop                中止运行中的蚁群
/colony-resume              从 checkpoint 恢复蚁群
Ctrl+Shift+A                展开蚁群详情面板
```

手动状态工具：
- `bg_colony_status`：仅在你明确要求手动快照时使用

### 示例

```
/colony 将整个项目从 CommonJS 迁移到 ESM，更新所有 import/export 和 tsconfig

/colony 为 src/ 下所有模块添加单元测试，覆盖率目标 80%

/colony 重构认证系统，从 session-based 迁移到 JWT，保持 API 兼容
```

## 信息素系统

蚂蚁通过信息素间接通信（stigmergy），不直接对话：

| 类型 | 释放者 | 含义 |
|------|--------|------|
| discovery | 侦察蚁 | 发现的代码结构、依赖关系 |
| progress | 工蚁 | 完成的变更、文件修改 |
| warning | 兵蚁 | 质量问题、冲突风险 |
| completion | 工蚁 | 任务完成标记 |
| dependency | 任意 | 文件间依赖关系 |

信息素按指数衰减（半衰期 10 分钟），避免过时信息误导后续蚂蚁。

## 文件锁定

每个任务声明操作的文件列表。女王保证：
- 同一文件同一时刻只有一只蚂蚁在修改
- 文件冲突的任务自动标记 `blocked`，等锁释放后恢复

## 巢穴结构

```
.ant-colony/{colony-id}/
├── state.json           蚁巢主状态
├── pheromone.jsonl      信息素追加日志
└── tasks/               每个任务一个文件（原子更新）
    ├── t-xxx.json
    └── t-yyy.json
```

## 安装

### 方式 1：通过 oh-pi 引导安装

```bash
npx oh-pi
```

推荐选择包含 `ant-colony` 的预设。

### 方式 2：作为 Pi package 安装

```bash
pi install npm:oh-pi
```

### 方式 3：直接使用扩展源码目录

如果你在本仓库里本地联调，可以把整个 `ant-colony/` 目录暴露给 Pi 扩展发现路径，而不是只链接少量单文件。因为当前真实实现已经主要落在：

- `core/`
- `pi/`
- `index.ts`

最小要求：Pi 必须能读取整个 `pi-package/extensions/ant-colony/` 目录结构。

## 模块说明

### 当前分层

- `core/`：核心调度、状态、解析、并发、运行时抽象
- `pi/`：Pi 集成层，包含 adapter、runtime、renderers、controls、shortcuts、tools
- `index.ts`：薄入口，仅转发到 `pi/extension.ts`
- 根层旧文件：兼容 wrapper，转发到 `core/` 或 `pi/`

## Beta Capability Matrix

| 能力 | 状态 | 说明 |
|------|------|------|
| `ant_colony` 启动 | ✅ Beta-ready | UI 模式后台运行，无 UI 时同步运行 |
| Scout / Worker / Soldier 生命周期 | ✅ Beta-ready | 包含 recovery 与 review |
| 被动进度推送 | ✅ Beta-ready | `COLONY_SIGNAL:*` |
| 手动状态 / 停止 / 恢复 | ✅ Beta-ready | `/colony-status` `/colony-stop` `/colony-resume` |
| 详情面板 | ✅ Beta-ready | `Ctrl+Shift+A` |
| 自适应并发 | ✅ Beta-ready | CPU / 内存 / 429 限流感知 |
| checkpoint 恢复 | ✅ Beta-ready | 基于 `.ant-colony/` |
| 兼容导入路径 | ✅ Beta-ready | 根层 wrapper 保留 |
| 全 provider 广泛验证 | ⚠️ Partial | 建议继续做 smoke test |
| 长期稳定 API 承诺 | ⚠️ Not yet | 当前按 Beta 对待 |

### 关键文件

| 文件 | 职责 |
|------|------|
| `core/types.ts` | 类型系统：蚂蚁、任务、信息素、巢穴状态 |
| `core/nest.ts` | 巢穴：共享状态与信息素查询边界 |
| `core/pheromone-store.ts` | 信息素存储抽象 |
| `core/concurrency.ts` | 自适应并发 |
| `core/parser.ts` | 子任务与信息素解析 |
| `core/spawner.ts` | 蚂蚁执行桥接层 |
| `core/queen.ts` | 女王调度：生命周期，任务波次，多轮迭代 |
| `core/runtime.ts` | 运行时抽象接口 |
| `core/ui.ts` | 核心报告与状态格式化 |
| `pi/adapter.ts` | Pi SDK 适配层 |
| `pi/runtime.ts` | 同步/后台 colony 启动逻辑 |
| `pi/renderers.ts` | 自定义消息渲染 |
| `pi/controls.ts` | 状态工具与命令 |
| `pi/shortcuts.ts` | 详情面板快捷键 |
| `pi/tools.ts` | `ant_colony` tool 注册 |
| `pi/extension.ts` | Pi 集成装配入口 |
| `index.ts` | 扩展默认导出入口 |
