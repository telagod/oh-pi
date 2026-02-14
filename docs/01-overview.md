# Pi Coding Agent 完整参考文档

## 一、项目概览

- **名称**: `@mariozechner/pi-coding-agent`
- **版本**: 0.52.12
- **作者**: Mario Zechner
- **协议**: MIT
- **仓库**: https://github.com/badlogic/pi-mono (packages/coding-agent)
- **官网**: https://shittycodingagent.ai / https://pi.dev
- **Node 要求**: >= 20.0.0

### 定位

Pi 是一个**极简终端编码代理工具**（Terminal Coding Harness）。核心理念是"适配你的工作流，而不是反过来"。通过 TypeScript Extensions、Skills、Prompt Templates、Themes 进行扩展，不需要 fork 修改内部代码。

### 设计哲学

- **No MCP** — 用 Skills 或 Extensions 替代
- **No Sub-agents** — 用 Extensions 自建或安装第三方包
- **No Permission Popups** — 用 Extensions 自建确认流程
- **No Plan Mode** — 用 Extensions 自建
- **No Built-in Todos** — 用 TODO.md 文件
- **No Background Bash** — 用 tmux

### 包架构

```
@mariozechner/pi-ai          → LLM 提供商抽象层
@mariozechner/pi-agent-core  → Agent 循环和消息类型
@mariozechner/pi-tui         → 终端 UI 组件库
@mariozechner/pi-coding-agent → CLI 和交互模式（主包）
```

## 二、安装与启动

```bash
npm install -g @mariozechner/pi-coding-agent
```

### 认证方式

**API Key:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

**订阅 OAuth:**
```bash
pi
/login  # 选择提供商
```

### 四种运行模式

| 模式 | 启动方式 | 用途 |
|------|----------|------|
| Interactive | `pi` (默认) | 完整 TUI 交互 |
| Print | `pi -p "prompt"` | 单次输出后退出 |
| JSON | `pi --mode json "prompt"` | JSON Lines 事件流 |
| RPC | `pi --mode rpc` | stdin/stdout JSON 协议，嵌入其他应用 |
| SDK | TypeScript import | 编程式嵌入 |

## 三、内置工具

默认 4 个工具: `read`, `bash`, `edit`, `write`

可选工具: `grep`, `find`, `ls`

```bash
pi --tools read,bash,edit,write    # 默认
pi --tools read,grep,find,ls       # 只读模式
pi --no-tools                      # 禁用所有内置工具
```

## 四、支持的提供商

### 订阅 (OAuth /login)

| 提供商 | 说明 |
|--------|------|
| Anthropic Claude Pro/Max | Claude 系列 |
| OpenAI ChatGPT Plus/Pro | GPT + Codex |
| GitHub Copilot | VS Code 联动 |
| Google Gemini CLI | Cloud Code Assist |
| Google Antigravity | Gemini 3 + Claude + GPT-OSS |

### API Key

| 提供商 | 环境变量 |
|--------|----------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| Google Vertex | Application Default Credentials |
| Amazon Bedrock | `AWS_PROFILE` / `AWS_ACCESS_KEY_ID` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| ZAI | `ZAI_API_KEY` |
| OpenCode Zen | `OPENCODE_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| Kimi For Coding | `KIMI_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |

### 自定义提供商

- **models.json**: `~/.pi/agent/models.json` 添加 Ollama/vLLM/LM Studio 等
- **Extensions**: 用 `pi.registerProvider()` 实现自定义 API/OAuth

### API Key 解析优先级

1. CLI `--api-key`
2. `auth.json` (API key 或 OAuth token)
3. 环境变量
4. `models.json` 自定义 key

### auth.json Key 格式

- Shell 命令: `"!security find-generic-password -ws 'anthropic'"`
- 环境变量名: `"MY_ANTHROPIC_KEY"`
- 字面值: `"sk-ant-..."`
