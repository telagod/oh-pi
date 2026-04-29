# oh-pi / Ant Colony for Pi 设计文档

> 本文档记录的是**早期 bootstrap / 配置器设计**。最新产品定位以 [`docs/PRODUCT.md`](./PRODUCT.md) 为准。

## 状态说明

本文原本面向“oh-pi = 一键配置 pi 的交互式 TUI 工具”的产品方向。

当前方向已经调整为：
- **Ant Colony for Pi** 是主产品
- **oh-pi** 是当前分发/引导入口
- 配置、主题、预设、技能装配是辅助层，不再是主叙事

因此，本文后续内容主要保留为：
- 早期设计记录
- bootstrap 层参考
- 交互式安装器资产

如果你正在阅读产品边界、使用场景或中长期定位，请优先看：
- [`docs/PRODUCT.md`](./PRODUCT.md)
- [`ROADMAP.md`](../ROADMAP.md)
- [`DECISIONS.md`](../DECISIONS.md)
- [`docs/ARCHITECTURE-REFACTOR.md`](./ARCHITECTURE-REFACTOR.md)

## 一、早期产品定位（归档）
## 二、交互流程设计

```
npx oh-p
  │
  ├─ 1. 欢迎 & 检测环境
  │     • 检测 pi 是否已安装，版本
  │     • 检测已有配置（~/.pi/agent/）
  │     • 检测终端类型和能力
  │
  ├─ 2. 模式选择
  │     • 🚀 快速配置（推荐预设，3步完成）
  │     • 🎛️ 自定义配置（逐项选择）
  │     • 📦 预设方案（选择预制配置包）
  │     • 🔄 更新/修改现有配置
  │
  ├─ 3. API 接入
  │     • 选择提供商（多选）
  │     • 输入 API Key / 选择 OAuth
  │     • 验证连接
  │     • 设置默认模型
  │
  ├─ 4. 功能预设
  │     • 扩展包选择
  │     • 技能包选择
  │     • MCP 服务器配置
  │     • Prompt Templates 选择
  │
  ├─ 5. 外观定制
  │     • 主题选择（含预览）
  │     • 快捷键方案（Default/Vim/Emacs）
  │     • 编辑器偏好
  │
  ├─ 6. 高级配置（可选）
  │     • 压缩策略
  │     • 重试策略
  │     • Shell 配置
  │     • 本地模型（Ollama 等）
  │
  └─ 7. 确认 & 应用
        • 预览生成的配置
        • 写入文件
        • 安装依赖包
        • 完成提示
```

## 三、预设方案 (Presets)

### 🟢 Starter — 新手入门

适合刚接触 AI 编码助手的用户。

```yaml
提供商: Anthropic (Claude Sonnet)
Thinking: medium
扩展:
  - confirm-destructive    # 危险命令确认
  - git-checkpoint         # Git 自动检查点
主题: dark (内置)
快捷键: 默认
Skills:
  - code-review            # 代码审查
Prompts:
  - review                 # 代码审查模板
  - fix                    # 修复模板
  - explain                # 解释模板
```

### 🔵 Pro Developer — 专业开发者

适合全栈开发者日常使用。

```yaml
提供商: Anthropic + OpenAI (双模型循环)
Thinking: high
扩展:
  - confirm-destructive    # 危险命令确认
  - git-checkpoint         # Git 自动检查点
  - auto-commit-on-exit    # 退出自动提交
  - plan-mode              # 计划模式
  - notify                 # 桌面通知
主题: rose-pine (社区)
快捷键: 默认
Skills:
  - code-review
  - brave-search           # 网络搜索
  - context-packer         # 上下文打包
  - session-analyzer       # 会话分析
Prompts:
  - review / fix / explain / refactor / test
MCP:
  - filesystem             # 文件系统增强
  - git                    # Git 操作增强
```

### 🟣 Security Researcher — 安全研究员

适合渗透测试/安全审计人员。

```yaml
提供商: Anthropic (Claude Opus, high thinking)
Thinking: high
扩展:
  - confirm-destructive
  - protected-paths        # 路径保护
  - permission-gate        # 权限门控
主题: 自定义暗色（高对比度）
Skills:
  - code-review
  - brave-search
AGENTS.md: 安全研究员预设（含攻防指令）
Prompts:
  - audit / pentest / cve-analyze / hardening
```

### 🟠 Data & AI Engineer — 数据/AI 工程师

适合 MLOps、数据工程、AI 应用开发。

```yaml
提供商: Anthropic + Google Gemini (大上下文)
Thinking: medium
扩展:
  - plan-mode
  - git-checkpoint
  - notify
主题: dark
Skills:
  - brave-search
  - code-review
  - youtube-transcript     # YouTube 转录
Prompts:
  - review / explain / optimize / pipeline
MCP:
  - filesystem
  - postgres               # 数据库操作
```

### 🔴 Minimal — 极简主义

只要核心功能，不要花哨。

```yaml
提供商: 用户选择 1 个
Thinking: off
扩展: (无)
主题: dark (内置)
快捷键: 默认
Skills: (无)
Prompts: (无)
```

### ⚫ Full Power — 全量安装

所有能装的都装上。

```yaml
提供商: 全部已配置的
Thinking: high
扩展: 全部预置扩展
主题: 多主题可切换
Skills: 全部预置技能
Prompts: 全部预置模板
MCP: 全部预置 MCP
```

## 四、预置资源清单

### 4.1 预置扩展 (Extensions)

#### 核心安全类

| 扩展 | 来源 | 说明 |
|------|------|------|
| `confirm-destructive` | 内置示例改写 | rm -rf / DROP 等危险命令二次确认 |
| `protected-paths` | 内置示例改写 | 保护 .env / node_modules / .git 等路径 |
| `permission-gate` | 内置示例改写 | 分级权限控制 |

#### 开发效率类

| 扩展 | 来源 | 说明 |
|------|------|------|
| `git-checkpoint` | 内置示例改写 | 每轮自动 git stash 检查点 |
| `auto-commit-on-exit` | 内置示例改写 | 退出时自动提交变更 |
| `dirty-repo-guard` | 内置示例改写 | 脏仓库警告 |
| `plan-mode` | pi-shit 或内置示例 | 计划模式（先规划后执行） |
| `notify` | 内置示例改写 | 任务完成桌面通知 |

#### 体验增强类

| 扩展 | 来源 | 说明 |
|------|------|------|
| `session-name` | 内置示例改写 | 自动会话命名 |
| `status-line` | 内置示例改写 | 状态栏增强 |
| `bookmark` | 内置示例改写 | 会话书签 |
| `summarize` | 内置示例改写 | 对话摘要 |

### 4.2 预置技能 (Skills)

| 技能 | 来源 | 说明 |
|------|------|------|
| `code-review` | pi-shit | 深度代码审查 |
| `brave-search` | pi-skills | 网络搜索 |
| `context-packer` | pi-shit | 上下文打包给其他 LLM |
| `session-analyzer` | pi-shit | 会话分析优化 |
| `youtube-transcript` | pi-shit | YouTube 视频转录 |
| `image-compress` | pi-shit | 图片压缩 |
| `markdown-converter` | pi-shit | Markdown 格式转换 |
| `pr-context-packer` | pi-shit | PR 上下文打包 |
| `code-simplifier` | pi-shit | 代码简化 |

#### oh-pi 自研技能

| 技能 | 说明 |
|------|------|
| `quick-setup` | 快速项目初始化（检测项目类型，生成 .pi/ 配置） |
| `git-workflow` | Git 工作流助手（分支策略、PR 模板、commit 规范） |
| `debug-helper` | 调试助手（错误分析、日志解读、性能分析） |
| `doc-generator` | 文档生成（README、API 文档、CHANGELOG） |
| `test-writer` | 测试生成（单元测试、集成测试框架检测） |

### 4.3 预置 Prompt Templates

| 模板 | 触发 | 内容 |
|------|------|------|
| `review` | `/review` | 审查代码：bug、安全、性能、可读性 |
| `fix` | `/fix` | 修复当前错误，最小改动原则 |
| `explain` | `/explain` | 解释代码/概念，由浅入深 |
| `refactor` | `/refactor` | 重构代码，保持行为不变 |
| `test` | `/test` | 为指定代码生成测试 |
| `optimize` | `/optimize` | 性能优化，给出基准对比 |
| `security` | `/security` | 安全审计，OWASP Top 10 |
| `document` | `/document` | 生成/更新文档 |
| `commit` | `/commit` | 生成 Conventional Commit 消息 |
| `pr` | `/pr` | 生成 PR 描述 |

### 4.4 预置主题 (Themes)

| 主题 | 风格 | 来源 |
|------|------|------|
| `oh-p-dark` | 深色，青蓝色调，高对比度 | 自研 |
| `oh-p-light` | 浅色，温暖色调 | 自研 |
| `cyberpunk` | 赛博朋克，霓虹紫+电光蓝 | 自研 |
| `nord` | Nord 配色方案 | 自研 |
| `dracula` | Dracula 配色方案 | 自研 |
| `catppuccin-mocha` | Catppuccin Mocha | 自研 |
| `catppuccin-latte` | Catppuccin Latte | 自研 |
| `gruvbox-dark` | Gruvbox 深色 | 自研 |
| `tokyo-night` | Tokyo Night | 自研 |
| `rose-pine` | Rosé Pine | pi-shit 包 |
| `rose-pine-dawn` | Rosé Pine Dawn | pi-shit 包 |

### 4.5 MCP 服务器预置

Pi 本身不内置 MCP，但可通过 Extension 桥接。oh-pi 提供 MCP 桥接扩展 + 预置服务器配置：

| MCP 服务器 | 说明 | 安装方式 |
|------------|------|----------|
| `@modelcontextprotocol/server-filesystem` | 文件系统增强操作 | npx |
| `@modelcontextprotocol/server-git` | Git 操作 | npx |
| `@modelcontextprotocol/server-postgres` | PostgreSQL 操作 | npx |
| `@modelcontextprotocol/server-sqlite` | SQLite 操作 | npx |
| `@modelcontextprotocol/server-brave-search` | Brave 搜索 | npx |
| `@modelcontextprotocol/server-puppeteer` | 浏览器自动化 | npx |
| `@modelcontextprotocol/server-fetch` | HTTP 请求 | npx |
| `@modelcontextprotocol/server-memory` | 知识图谱记忆 | npx |
| `@modelcontextprotocol/server-sequential-thinking` | 结构化思考 | npx |

### 4.6 预置快捷键方案

#### Default（Pi 默认）
保持原样。

#### Vim 方案
```json
{
  "cursorUp": ["up", "alt+k"],
  "cursorDown": ["down", "alt+j"],
  "cursorLeft": ["left", "alt+h"],
  "cursorRight": ["right", "alt+l"],
  "cursorWordLeft": ["alt+left", "alt+b"],
  "cursorWordRight": ["alt+right", "alt+w"],
  "deleteToLineEnd": ["ctrl+k"],
  "deleteToLineStart": ["ctrl+u"]
}
```

#### Emacs 方案
```json
{
  "cursorUp": ["up", "ctrl+p"],
  "cursorDown": ["down", "ctrl+n"],
  "cursorLeft": ["left", "ctrl+b"],
  "cursorRight": ["right", "ctrl+f"],
  "cursorWordLeft": ["alt+left", "alt+b"],
  "cursorWordRight": ["alt+right", "alt+f"],
  "deleteCharForward": ["delete", "ctrl+d"],
  "deleteCharBackward": ["backspace", "ctrl+h"],
  "cursorLineStart": ["home", "ctrl+a"],
  "cursorLineEnd": ["end", "ctrl+e"],
  "newLine": ["shift+enter", "ctrl+j"]
}
```

### 4.7 预置 AGENTS.md 模板

#### 通用开发者
```markdown
# Project Guidelines

## Code Style
- Follow existing project conventions
- Use meaningful variable names
- Keep functions under 50 lines
- Add comments for complex logic

## Git
- Use Conventional Commits (feat/fix/refactor/docs/test/chore)
- Atomic commits, one concern per commit
- Never force push to main

## Safety
- Never hardcode secrets or API keys
- Always validate user input
- Handle errors explicitly
```

#### 安全研究员
```markdown
# Security Research Environment

## Authorization
Authorized security researcher with full access to local/CTF/lab environments.

## Approach
- Enumerate before exploit
- Document all findings
- Minimal footprint
- Clean up after testing

## Tools
- Use nmap, burp, sqlmap, etc. as needed
- Write custom scripts when tools fall short
- Always capture evidence
```

#### 全栈开发者
```markdown
# Full-Stack Development

## Stack Awareness
- Detect and respect the project's tech stack
- Frontend: React/Vue/Svelte patterns
- Backend: REST/GraphQL conventions
- Database: Migration-first approach

## Quality
- Write tests for new features
- Update docs when changing APIs
- Consider accessibility (a11y)
- Performance: measure before optimizing
```

## 五、技术架构

### 5.1 项目结构

```
oh-pi/
├── package.json
├── bin/
│   └── oh-pi.ts                    # CLI 入口
├── src/
│   ├── index.ts                   # 主流程
│   ├── tui/                       # 交互式 TUI
│   │   ├── welcome.ts             # 欢迎页
│   │   ├── mode-select.ts         # 模式选择
│   │   ├── provider-setup.ts      # 提供商配置
│   │   ├── preset-select.ts       # 预设选择
│   │   ├── extension-select.ts    # 扩展选择
│   │   ├── skill-select.ts        # 技能选择
│   │   ├── theme-select.ts        # 主题选择（含预览）
│   │   ├── keybinding-select.ts   # 快捷键选择
│   │   ├── mcp-setup.ts           # MCP 配置
│   │   ├── advanced.ts            # 高级配置
│   │   └── confirm-apply.ts       # 确认应用
│   ├── config/                    # 配置生成
│   │   ├── settings.ts            # settings.json 生成
│   │   ├── auth.ts                # auth.json 生成
│   │   ├── models.ts              # models.json 生成
│   │   └── keybindings.ts         # keybindings.json 生成
│   ├── presets/                   # 预设方案定义
│   │   ├── starter.ts
│   │   ├── pro-developer.ts
│   │   ├── security.ts
│   │   ├── data-ai.ts
│   │   ├── minimal.ts
│   │   └── full-power.ts
│   ├── resources/                 # 预置资源
│   │   ├── extensions/            # 自研扩展
│   │   ├── skills/                # 自研技能
│   │   ├── prompts/               # 预置模板
│   │   ├── themes/                # 预置主题 JSON
│   │   └── agents/                # AGENTS.md 模板
│   └── utils/
│       ├── detect.ts              # 环境检测
│       ├── install.ts             # 包安装
│       └── validate.ts            # API Key 验证
├── pi-package/                    # 作为 pi package 发布的资源
│   ├── package.json
│   ├── extensions/
│   ├── skills/
│   ├── prompts/
│   └── themes/
└── docs/
```

### 5.2 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 运行方式 | `npx oh-pi` | 零安装，即用即走 |
| TUI 框架 | `@inquirer/prompts` | 成熟、轻量、交互丰富 |
| 样式 | `chalk` | Pi 自身依赖，无额外开销 |
| 文件操作 | Node.js 内置 | 无额外依赖 |
| API 验证 | 直接 HTTP 请求 | 轻量验证连通性 |
| 包管理 | 调用 `pi install` | 复用 Pi 原生能力 |

### 5.3 核心能力

#### API Key 快捷接入

```
选择提供商:
  ☑ Anthropic (推荐)
  ☑ OpenAI
  ☐ Google Gemini
  ☐ Amazon Bedrock
  ☐ Groq (免费)
  ☐ OpenRouter (多模型聚合)
  ☐ 本地模型 (Ollama/vLLM)

→ Anthropic API Key: sk-ant-***
  ✓ 验证成功! Claude Sonnet 4 可用

→ OpenAI API Key: sk-***
  ✓ 验证成功! GPT-4o 可用

默认模型: Claude Sonnet 4 (推荐)
Thinking Level: medium
循环模型: Claude Sonnet 4, GPT-4o
```

#### 主题预览

```
┌─ 主题预览: cyberpunk ──────────────────────┐
│                                             │
│  > 你好，帮我重构这个函数                      │
│                                             │
│  ┌─ bash ──────────────────────────────┐    │
│  │ $ cat src/utils.ts                  │    │
│  │ export function parse(input) {      │    │
│  │   return JSON.parse(input);         │    │
│  │ }                                   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  我来帮你重构这个函数，添加错误处理...          │
│                                             │
└─────────────────────────────────────────────┘
  ← → 切换主题  Enter 确认  Esc 取消
```

## 六、分发策略

### 6.1 双重分发

1. **npx oh-pi** — 配置器工具（交互式 TUI）
2. **pi install npm:oh-pi** — Pi Package（扩展/技能/主题/模板）

用户可以只用配置器，也可以只装 Pi Package，也可以两者都用。

### 6.2 npm 包结构

```json
{
  "name": "oh-pi",
  "bin": { "oh-pi": "./bin/oh-pi.js" },
  "keywords": ["pi-package", "pi-coding-agent", "configuration", "setup"],
  "pi": {
    "extensions": ["./pi-package/extensions"],
    "skills": ["./pi-package/skills"],
    "prompts": ["./pi-package/prompts"],
    "themes": ["./pi-package/themes"]
  }
}
```

## 七、开发路线

### Phase 1 — MVP (核心配置器)
- [ ] 项目脚手架 (package.json, tsconfig, bin)
- [ ] 环境检测 (pi 版本, 已有配置)
- [ ] API Key 配置 + 验证 (Anthropic, OpenAI, Groq)
- [ ] 预设方案选择 (Starter, Pro, Minimal)
- [ ] settings.json / auth.json 生成
- [ ] 基础主题 (oh-p-dark, oh-p-light)
- [ ] 基础 Prompt Templates (review, fix, explain)

### Phase 2 — 完整体验
- [ ] 全部提供商支持 (含 OAuth 引导)
- [ ] 全部预设方案
- [ ] 主题预览 TUI
- [ ] 快捷键方案选择
- [ ] 自研 Skills (quick-setup, git-workflow, debug-helper)
- [ ] 自研 Extensions (confirm-destructive, git-checkpoint 改良版)
- [ ] MCP 桥接扩展 + 预置服务器
- [ ] AGENTS.md 模板选择

### Phase 3 — 生态
- [ ] `oh-pi update` 更新预置资源
- [ ] `oh-pi doctor` 诊断配置问题
- [ ] `oh-pi export/import` 配置导入导出
- [ ] 社区预设方案贡献机制
- [ ] 在线配置生成器 (Web)
