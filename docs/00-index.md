# Pi Coding Agent 文档汇总索引

> 基于 `@mariozechner/pi-coding-agent` v0.52.12 全部官方文档整理
> 整理时间: 2026-02-14

## 文档目录

| # | 文件 | 内容 |
|---|------|------|
| 01 | [概览](01-overview.md) | 项目定位、设计哲学、包架构、安装启动、运行模式、提供商与认证 |
| 02 | [交互模式](02-interactive-mode.md) | 界面布局、编辑器功能、命令系统、快捷键、消息队列、终端兼容性 |
| 03 | [会话管理](03-sessions.md) | JSONL 树结构、条目类型、分支/tree/fork、上下文压缩、分支摘要 |
| 04 | [扩展系统](04-extensions.md) | Extension API、事件生命周期、自定义工具、UI 交互、状态管理、示例索引 |
| 05 | [Skills/Prompts/Themes/Packages](05-skills-prompts-themes-packages.md) | 技能包、提示模板、主题定制、包管理与分发 |
| 06 | [Settings/SDK/RPC/TUI](06-settings-sdk-rpc-tui.md) | 全部配置项、SDK 编程接口、RPC 协议、TUI 组件系统、自定义模型 |
| 07 | [CLI 参考](07-cli-reference.md) | 完整 CLI 选项、目录结构、平台支持、关键数字 |

## 核心概念速查

### Pi 是什么

一个极简终端编码代理工具。默认给 LLM 四个工具（read/bash/edit/write），通过 Extensions、Skills、Prompt Templates、Themes 扩展能力。不内置 sub-agents、plan mode、MCP、permission popups — 全部通过扩展实现。

### 四层扩展体系

```
┌─────────────────────────────────────────────┐
│  Pi Packages — 打包分发（npm/git）           │
│  ┌─────────────────────────────────────────┐ │
│  │  Extensions — TypeScript 代码扩展        │ │
│  │  • 自定义工具、命令、快捷键、UI          │ │
│  │  • 事件拦截、状态管理、自定义提供商      │ │
│  ├─────────────────────────────────────────┤ │
│  │  Skills — 按需加载的能力包               │ │
│  │  • SKILL.md + 脚本/资源                  │ │
│  │  • /skill:name 调用或 Agent 自动加载     │ │
│  ├─────────────────────────────────────────┤ │
│  │  Prompt Templates — 可复用提示模板       │ │
│  │  • .md 文件，/name 展开                  │ │
│  │  • 支持位置参数 $1 $2 $@                 │ │
│  ├─────────────────────────────────────────┤ │
│  │  Themes — JSON 颜色主题                  │ │
│  │  • 51 个 color tokens，热重载            │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 四种运行模式

```
Interactive ← 完整 TUI（默认）
Print       ← 单次输出 (pi -p)
JSON        ← 事件流 (pi --mode json)
RPC         ← stdin/stdout 协议 (pi --mode rpc)
SDK         ← TypeScript import (createAgentSession)
```

### 会话树结构

```
SessionHeader (文件首行，元数据)
  └─ MessageEntry (id/parentId 链接)
       ├─ user → assistant → toolResult → ...
       │    └─ [分支] user → assistant → ...
       ├─ CompactionEntry (压缩摘要)
       ├─ BranchSummaryEntry (分支摘要)
       ├─ ModelChangeEntry
       ├─ CustomEntry (扩展状态)
       └─ LabelEntry (书签)
```

### 配置优先级

```
CLI flags > 项目 .pi/settings.json > 全局 ~/.pi/agent/settings.json
```

### API Key 解析优先级

```
--api-key > auth.json > 环境变量 > models.json
```

## 对 oh-pi 项目的价值

本文档为 oh-pi（一键配置 pi-coding-agent 的项目）提供完整的知识基础：

1. **配置项全览** — 知道 settings.json 所有字段，可生成交互式配置
2. **目录结构** — 知道 `~/.pi/agent/` 和 `.pi/` 下每个文件的作用
3. **扩展系统** — 可帮用户安装/配置/生成 Extensions
4. **Skills/Prompts/Themes** — 可帮用户发现、安装、配置
5. **包管理** — 知道 `pi install/remove/list/update/config` 全部用法
6. **提供商认证** — 知道所有提供商的 API key 环境变量和 auth.json 格式
7. **自定义模型** — 知道 models.json 格式，可帮配置 Ollama/vLLM 等
8. **快捷键** — 知道所有 action 和默认绑定，可生成 keybindings.json
9. **主题** — 知道 51 个 color token，可生成自定义主题

## 原始文档位置

```
/home/telagod/.local/share/fnm/node-versions/v24.9.0/installation/lib/node_modules/@mariozechner/pi-coding-agent/
├── README.md                    # 主文档
├── docs/
│   ├── compaction.md            # 压缩机制
│   ├── custom-provider.md       # 自定义提供商
│   ├── development.md           # 开发指南
│   ├── extensions.md            # 扩展系统（最大，63KB）
│   ├── json.md                  # JSON 事件流模式
│   ├── keybindings.md           # 快捷键
│   ├── models.md                # 自定义模型
│   ├── packages.md              # 包管理
│   ├── prompt-templates.md      # 提示模板
│   ├── providers.md             # 提供商配置
│   ├── rpc.md                   # RPC 协议（32KB）
│   ├── sdk.md                   # SDK 接口（28KB）
│   ├── session.md               # 会话格式
│   ├── settings.md              # 配置项
│   ├── shell-aliases.md         # Shell 别名
│   ├── skills.md                # 技能包
│   ├── terminal-setup.md        # 终端配置
│   ├── termux.md                # Android Termux
│   ├── themes.md                # 主题
│   ├── tree.md                  # 树导航
│   ├── tui.md                   # TUI 组件（28KB）
│   └── windows.md               # Windows 配置
└── examples/
    ├── extensions/              # 60+ 扩展示例
    │   ├── hello.ts             # 最简示例
    │   ├── subagent/            # 子代理系统
    │   ├── plan-mode/           # 计划模式
    │   ├── custom-provider-*/   # 自定义提供商
    │   └── ...
    └── sdk/                     # 12 个 SDK 示例
        ├── 01-minimal.ts
        ├── ...
        └── 12-full-control.ts
```
