# Pi CLI 完整参考 & 目录结构

## 一、CLI 用法

```bash
pi [options] [@files...] [messages...]
```

### 文件参数

```bash
pi @prompt.md "Answer this"           # 包含文件内容
pi -p @screenshot.png "What's in this image?"  # 图片
pi @code.ts @test.ts "Review these files"      # 多文件
```

### 包管理命令

```bash
pi install <source> [-l]    # 安装包，-l 项目级
pi remove <source> [-l]     # 移除包
pi update [source]          # 更新（跳过锁定版本）
pi list                     # 列出已安装包
pi config                   # 启用/禁用包资源
```

### 模式选项

| Flag | 说明 |
|------|------|
| (默认) | 交互模式 |
| `-p`, `--print` | 输出响应后退出 |
| `--mode json` | JSON Lines 事件流 |
| `--mode rpc` | RPC 进程集成 |
| `--export <in> [out]` | 导出会话为 HTML |

### 模型选项

| 选项 | 说明 |
|------|------|
| `--provider <name>` | 提供商 |
| `--model <pattern>` | 模型（支持 `provider/id` 和 `:<thinking>`） |
| `--api-key <key>` | API key |
| `--thinking <level>` | off/minimal/low/medium/high/xhigh |
| `--models <patterns>` | Ctrl+P 循环模型（逗号分隔） |
| `--list-models [search]` | 列出可用模型 |

### 会话选项

| 选项 | 说明 |
|------|------|
| `-c`, `--continue` | 继续最近会话 |
| `-r`, `--resume` | 浏览选择会话 |
| `--session <path>` | 指定会话文件或部分 UUID |
| `--session-dir <dir>` | 自定义会话存储目录 |
| `--no-session` | 临时模式 |

### 工具选项

| 选项 | 说明 |
|------|------|
| `--tools <list>` | 启用指定内置工具（默认 read,bash,edit,write） |
| `--no-tools` | 禁用所有内置工具 |

可用内置工具: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`

### 资源选项

| 选项 | 说明 |
|------|------|
| `-e`, `--extension <source>` | 加载扩展（可重复） |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <path>` | 加载技能（可重复） |
| `--no-skills` | 禁用技能发现 |
| `--prompt-template <path>` | 加载模板（可重复） |
| `--no-prompt-templates` | 禁用模板发现 |
| `--theme <path>` | 加载主题（可重复） |
| `--no-themes` | 禁用主题发现 |

`--no-*` 可与显式 flag 组合，精确控制加载内容。

### 其他选项

| 选项 | 说明 |
|------|------|
| `--system-prompt <text>` | 替换默认 system prompt |
| `--append-system-prompt <text>` | 追加到 system prompt |
| `--verbose` | 强制详细启动 |
| `-h`, `--help` | 帮助 |
| `-v`, `--version` | 版本 |

### 常用示例

```bash
pi "List all .ts files in src/"              # 交互+初始 prompt
pi -p "Summarize this codebase"              # 非交互
pi --model openai/gpt-4o "Help me refactor"  # 指定模型
pi --model sonnet:high "Solve this"          # 模型+thinking
pi --models "claude-*,gpt-4o"                # 限制循环模型
pi --tools read,grep,find,ls -p "Review"     # 只读模式
pi --thinking high "Complex problem"         # 高 thinking
```

---

## 二、目录结构总览

### 全局配置 (`~/.pi/agent/`)

```
~/.pi/agent/
├── settings.json          # 全局设置
├── auth.json              # API keys & OAuth tokens (0600)
├── models.json            # 自定义模型/提供商
├── keybindings.json       # 自定义快捷键
├── AGENTS.md              # 全局 context file
├── SYSTEM.md              # 替换默认 system prompt (可选)
├── APPEND_SYSTEM.md       # 追加 system prompt (可选)
├── extensions/            # 全局扩展
│   ├── my-ext.ts
│   └── my-ext-dir/
│       └── index.ts
├── skills/                # 全局技能
│   └── my-skill/
│       └── SKILL.md
├── prompts/               # 全局模板
│   └── review.md
├── themes/                # 全局主题
│   └── my-theme.json
├── sessions/              # 会话存储
│   └── --path--/
│       └── <timestamp>_<uuid>.jsonl
├── git/                   # git 包安装目录
└── npm/                   # npm 包安装目录 (项目级用 .pi/npm/)
```

### 项目配置 (`.pi/`)

```
<project>/.pi/
├── settings.json          # 项目设置（覆盖全局）
├── SYSTEM.md              # 项目 system prompt
├── APPEND_SYSTEM.md       # 项目追加 prompt
├── extensions/            # 项目扩展
├── skills/                # 项目技能
├── prompts/               # 项目模板
├── themes/                # 项目主题
├── git/                   # 项目级 git 包
└── npm/                   # 项目级 npm 包
```

### Context Files 加载顺序

1. `~/.pi/agent/AGENTS.md` (全局)
2. 从 cwd 向上遍历每个父目录的 `AGENTS.md`
3. 当前目录的 `AGENTS.md`

所有匹配文件拼接。也支持 `CLAUDE.md` 文件名。

---

## 三、Pi Package 结构

```
my-pi-package/
├── package.json           # 含 "pi" manifest 和 "pi-package" keyword
├── extensions/            # 扩展 (.ts/.js)
├── skills/                # 技能 (SKILL.md 子目录)
├── prompts/               # 模板 (.md)
└── themes/                # 主题 (.json)
```

---

## 四、平台支持

| 平台 | 说明 |
|------|------|
| macOS / Linux | 原生支持 |
| Windows | 需要 bash (Git Bash / Cygwin / WSL) |
| Android (Termux) | 通过 Termux 运行，无图片剪贴板 |

---

## 五、关键数字

| 指标 | 值 |
|------|-----|
| 内置工具 | 7 个 (read, bash, edit, write, grep, find, ls) |
| 默认启用 | 4 个 (read, bash, edit, write) |
| 主题 color tokens | 51 个 |
| 支持的 API 提供商 | 17+ |
| 订阅提供商 | 5 个 |
| 工具输出截断 | 50KB / 2000 行 |
| 会话格式 | JSONL 树结构 v3 |
| 压缩保留 token | 20000 (默认) |
| 压缩预留 token | 16384 (默认) |
| 重试次数 | 3 (默认) |
| Node.js 要求 | >= 20.0.0 |
