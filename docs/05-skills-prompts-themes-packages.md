# Pi Skills、Prompt Templates、Themes、Packages

## 一、Skills（技能包）

Skills 是按需加载的能力包，遵循 [Agent Skills 标准](https://agentskills.io)。

### 放置位置

| 位置 | 范围 |
|------|------|
| `~/.pi/agent/skills/` | 全局 |
| `.pi/skills/` | 项目级 |
| Packages 的 `skills/` 目录 | 包级 |
| `settings.json` 的 `skills` 数组 | 额外路径 |
| `--skill <path>` | CLI 指定 |

发现规则：根目录直接 `.md` 文件 + 子目录递归 `SKILL.md`。

### 工作原理

1. 启动时扫描，提取 name 和 description
2. System prompt 中以 XML 格式列出可用 skills
3. 任务匹配时，Agent 用 `read` 加载完整 SKILL.md
4. Agent 按指令执行，使用相对路径引用脚本和资源

### SKILL.md 格式

```markdown
---
name: my-skill
description: 技能描述，决定何时被加载。要具体。
---

# My Skill

## Setup
\`\`\`bash
cd /path/to/skill && npm install
\`\`\`

## Usage
\`\`\`bash
./scripts/process.sh <input>
\`\`\`
```

### Frontmatter 字段

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | ✅ | ≤64字符，小写+数字+连字符，须匹配父目录名 |
| `description` | ✅ | ≤1024字符，描述功能和触发场景 |
| `license` | ❌ | 许可证 |
| `compatibility` | ❌ | 环境要求 |
| `metadata` | ❌ | 任意键值对 |
| `disable-model-invocation` | ❌ | true 时隐藏于 system prompt，只能 `/skill:name` 调用 |

### Skill 命令

```bash
/skill:brave-search           # 加载并执行
/skill:pdf-tools extract      # 带参数
```

可在 `/settings` 或 `settings.json` 中切换 `enableSkillCommands`。

### 跨工具 Skills

可加载 Claude Code 或 OpenAI Codex 的 skills：
```json
{ "skills": ["~/.claude/skills", "~/.codex/skills"] }
```

---

## 二、Prompt Templates（提示模板）

Markdown 片段，输入 `/name` 展开。

### 放置位置

| 位置 | 范围 |
|------|------|
| `~/.pi/agent/prompts/*.md` | 全局 |
| `.pi/prompts/*.md` | 项目级 |
| Packages 的 `prompts/` 目录 | 包级 |
| `--prompt-template <path>` | CLI 指定 |

发现规则：非递归，仅 prompts/ 根目录。

### 格式

```markdown
---
description: 审查 staged git 变更
---
审查 staged changes (`git diff --cached`)。关注：
- Bug 和逻辑错误
- 安全问题
- 错误处理缺失
```

文件名即命令名：`review.md` → `/review`

### 参数支持

- `$1`, `$2`, ... — 位置参数
- `$@` 或 `$ARGUMENTS` — 所有参数
- `${@:N}` — 从第 N 个开始
- `${@:N:L}` — 从第 N 个取 L 个

```
/component Button "onClick handler" "disabled support"
```

---

## 三、Themes（主题）

JSON 文件定义 TUI 颜色。支持热重载。

### 放置位置

- 内置: `dark`, `light`
- 全局: `~/.pi/agent/themes/*.json`
- 项目: `.pi/themes/*.json`
- Packages / settings / CLI

### 主题格式

```json
{
  "$schema": "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "my-theme",
  "vars": { "primary": "#00aaff", "secondary": 242 },
  "colors": { /* 必须定义全部 51 个 color token */ }
}
```

### 51 个 Color Token 分类

| 分类 | 数量 | 示例 |
|------|------|------|
| Core UI | 11 | accent, border, success, error, warning, muted, dim, text... |
| Backgrounds & Content | 11 | selectedBg, userMessageBg, toolPendingBg, toolTitle... |
| Markdown | 10 | mdHeading, mdLink, mdCode, mdCodeBlock... |
| Tool Diffs | 3 | toolDiffAdded, toolDiffRemoved, toolDiffContext |
| Syntax Highlighting | 9 | syntaxComment, syntaxKeyword, syntaxFunction... |
| Thinking Level Borders | 6 | thinkingOff ~ thinkingXhigh |
| Bash Mode | 1 | bashMode |

### 颜色值格式

| 格式 | 示例 | 说明 |
|------|------|------|
| Hex | `"#ff0000"` | 6位 RGB |
| 256-color | `39` | xterm 256 色索引 |
| Variable | `"primary"` | 引用 vars |
| Default | `""` | 终端默认色 |

---

## 四、Pi Packages（包管理）

打包 Extensions、Skills、Prompts、Themes 通过 npm 或 git 分享。

### 安装管理

```bash
pi install npm:@foo/bar@1.0.0       # npm（带版本锁定）
pi install git:github.com/user/repo@v1  # git（带 ref 锁定）
pi install https://github.com/user/repo # HTTPS
pi install ./local/path              # 本地路径
pi remove npm:@foo/bar
pi list                              # 列出已安装
pi update                            # 更新（跳过锁定版本）
pi config                            # 启用/禁用资源
```

`-l` 参数安装到项目级（`.pi/`），否则全局（`~/.pi/agent/`）。

临时试用：`pi -e npm:@foo/bar`

### 创建包

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

无 `pi` manifest 时自动发现 `extensions/`, `skills/`, `prompts/`, `themes/` 目录。

### 依赖处理

- 运行时依赖放 `dependencies`
- Pi 核心包放 `peerDependencies` 用 `"*"` 范围：
  `@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@sinclair/typebox`
- 其他 pi 包需 bundle：放 `dependencies` + `bundledDependencies`

### 包过滤

```json
{
  "packages": [
    { "source": "npm:my-package", "extensions": ["ext/*.ts"], "skills": [], "prompts": ["prompts/review.md"] }
  ]
}
```

`[]` = 不加载该类型，`!pattern` = 排除，`+path` = 强制包含。
