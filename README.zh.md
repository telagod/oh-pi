<div align="center">

<img src="./logo.svg" width="180" alt="oh-pi logo"/>

# 🐜 oh-pi

**一条命令，增强 [pi-coding-agent](https://github.com/badlogic/pi-mono)。**

就像 oh-my-zsh 之于 pi —— 但带有自主蚁群系统。

[![npm](https://img.shields.io/npm/v/oh-pi)](https://www.npmjs.com/package/oh-pi)
[![license](https://img.shields.io/npm/l/oh-pi)](./LICENSE)
[![node](https://img.shields.io/node/v/oh-pi)](https://nodejs.org)

[English](./README.md) | [中文](./README.zh.md) | [Français](./README.fr.md)

```bash
npx oh-pi
```

</div>

---

## 为什么选择 oh-pi

pi-coding-agent 开箱即用已经很强大，但手动配置供应商、主题、扩展、技能和提示词模板非常繁琐。oh-pi 提供现代化 TUI，一分钟内搞定一切 —— 还附带**蚁群集群**，将 pi 变成多智能体系统。

## 快速开始

```bash
npx oh-pi    # 配置一切
pi           # 开始编码
```

就这么简单。oh-pi 检测你的环境，引导你完成设置，并为你生成 `~/.pi/agent/` 配置。

已有配置？oh-pi 会检测到并提供**覆盖前备份**。

## 你将获得

```
~/.pi/agent/
├── auth.json            API 密钥（0600 权限）
├── settings.json        模型、主题、思考级别
├── keybindings.json     Vim/Emacs 快捷键（可选）
├── AGENTS.md            角色专属 AI 指南
├── extensions/          4 个扩展
│   ├── safe-guard       危险命令确认 + 路径保护
│   ├── git-guard        自动 stash 检查点 + 脏仓库警告
│   ├── auto-session     根据首条消息自动命名会话
│   └── ant-colony/      🐜 自主多智能体蚁群
├── prompts/             10 个模板（/review /fix /commit /test ...）
├── skills/              4 个技能（debug、git、setup、colony）
└── themes/              6 个自定义主题
```

## 设置模式

| 模式 | 步骤 | 适用场景 |
|------|------|----------|
| 🚀 **快速** | 3 | 选供应商 → 输入密钥 → 完成 |
| 📦 **预设** | 2 | 选择角色配置 → 输入密钥 |
| 🎛️ **自定义** | 6 | 自己选择所有选项 |

### 预设方案

| | 主题 | 思考级别 | 包含 |
|---|------|----------|------|
| 🟢 入门 | oh-pi Dark | 中等 | 安全 + git 基础 |
| 🔵 专业开发者 | Catppuccin | 高 | 完整工具链 |
| 🟣 安全研究员 | Cyberpunk | 高 | 审计 + 渗透测试 |
| 🟠 数据 & AI | Tokyo Night | 中等 | MLOps + 流水线 |
| 🔴 极简 | Default | 关闭 | 仅核心功能 |
| ⚫ 全功率 | oh-pi Dark | 高 | 所有功能 + 蚁群 |

### 供应商

Anthropic · OpenAI · Google Gemini · Groq · OpenRouter · xAI · Mistral · [FOXNIO](https://www.foxnio.com)（推荐公益 Claude 供应商）

自动从环境变量检测 API 密钥。

## 🐜 蚁群系统

核心特性。模拟真实蚂蚁生态的多智能体集群。

```
你："把认证从 session 重构为 JWT"

oh-pi:
  🔍 侦察蚁探索代码库（haiku — 快速、低成本）
  📋 根据发现生成任务池
  ⚒️  工蚁并行执行任务（sonnet — 能力强）
  🛡️ 兵蚁审查所有变更（sonnet — 细致）
  ✅ 完成 — 汇总报告及指标
```

### 为什么是蚂蚁？

真实蚁群无需中央控制即可解决复杂问题。每只蚂蚁遵循简单规则，通过**信息素轨迹**通信，蚁群自组织运作。oh-pi 直接映射了这一模型：

| 真实蚂蚁 | oh-pi |
|----------|-------|
| 侦察蚁发现食物 | 侦察蚁扫描代码库，识别目标 |
| 信息素轨迹 | `.ant-colony/pheromone.jsonl` — 共享发现 |
| 工蚁搬运食物 | 工蚁在分配的文件上执行任务 |
| 兵蚁守卫巢穴 | 兵蚁审查变更，请求修复 |
| 食物越多 → 蚂蚁越多 | 任务越多 → 并发越高（自动适配） |
| 信息素蒸发 | 10 分钟半衰期 — 过时信息自动淡化 |

### 自动触发

LLM 自行决定何时部署蚁群，你无需操心：

- **≥3 个文件**需要修改 → 蚁群
- 可**并行工作流** → 蚁群
- **单文件**修改 → 直接执行（无蚁群开销）

或手动触发：

```
/colony 将整个项目从 CJS 迁移到 ESM
```

### 自适应并发

蚁群自动为你的机器找到最优并行度：

```
冷启动       →  1-2 只蚂蚁（保守）
探索阶段     →  每波 +1，监控吞吐量
吞吐量下降   →  锁定最优值，稳定运行
CPU > 85%   →  立即减少
429 限流     →  并发减半 + 指数退避（15s→30s→60s）
任务完成     →  缩减至最小值
```

### 文件安全

一个文件一只蚂蚁，始终如此。冲突任务自动阻塞，锁释放后恢复执行。

## 主题

| | |
|---|---|
| 🌙 **oh-pi Dark** | 青色 + 紫色，高对比度 |
| 🌙 **Cyberpunk** | 霓虹洋红 + 电光青 |
| 🌙 **Nord** | 北极蓝色调 |
| 🌙 **Catppuccin Mocha** | 暗底柔和色 |
| 🌙 **Tokyo Night** | 蓝紫暮光 |
| 🌙 **Gruvbox Dark** | 暖色复古风 |

## 提示词模板

```
/review    代码审查：bug、安全、性能
/fix       最小改动修复错误
/explain   代码解释，由浅入深
/refactor  保持行为的重构
/test      生成测试
/commit    Conventional Commit 提交信息
/pr        Pull Request 描述
/security  OWASP 安全审计
/optimize  性能优化
/document  生成文档
```

## AGENTS.md 模板

| 模板 | 侧重 |
|------|------|
| 通用开发者 | 通用编码指南 |
| 全栈开发者 | 前端 + 后端 + 数据库 |
| 安全研究员 | 渗透测试 & 审计 |
| 数据 & AI 工程师 | MLOps & 流水线 |
| 🐜 蚁群操作员 | 多智能体编排 |

## 也是 Pi 包

跳过配置器，直接安装资源：

```bash
pi install npm:oh-pi
```

将所有主题、提示词、技能和扩展添加到你现有的 pi 配置中。

## 环境要求

- Node.js ≥ 20
- 至少一个 LLM API 密钥
- pi-coding-agent（缺失时自动安装）

## 许可证

MIT
