# Pi Settings、SDK、RPC、TUI 组件

## 一、Settings（配置）

### 文件位置

| 位置 | 范围 |
|------|------|
| `~/.pi/agent/settings.json` | 全局 |
| `.pi/settings.json` | 项目级（覆盖全局） |

嵌套对象合并，项目覆盖全局。

### 全部配置项

#### 模型与 Thinking

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `defaultProvider` | string | - | 默认提供商 |
| `defaultModel` | string | - | 默认模型 ID |
| `defaultThinkingLevel` | string | - | off/minimal/low/medium/high/xhigh |
| `hideThinkingBlock` | boolean | false | 隐藏 thinking 输出 |
| `thinkingBudgets` | object | - | 各级别 token 预算 |

#### UI 与显示

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `theme` | string | "dark" | 主题名 |
| `quietStartup` | boolean | false | 隐藏启动头 |
| `doubleEscapeAction` | string | "tree" | 双击 Escape 动作: tree/fork/none |
| `editorPaddingX` | number | 0 | 编辑器水平内边距 (0-3) |
| `autocompleteMaxVisible` | number | 5 | 自动补全最大可见项 (3-20) |
| `showHardwareCursor` | boolean | false | 显示终端光标 |

#### 压缩

| 设置 | 默认 | 说明 |
|------|------|------|
| `compaction.enabled` | true | 启用自动压缩 |
| `compaction.reserveTokens` | 16384 | LLM 响应预留 token |
| `compaction.keepRecentTokens` | 20000 | 保留的近期 token |

#### 重试

| 设置 | 默认 | 说明 |
|------|------|------|
| `retry.enabled` | true | 启用自动重试 |
| `retry.maxRetries` | 3 | 最大重试次数 |
| `retry.baseDelayMs` | 2000 | 指数退避基础延迟 |
| `retry.maxDelayMs` | 60000 | 最大服务端请求延迟 |

#### 消息投递

| 设置 | 默认 | 说明 |
|------|------|------|
| `steeringMode` | "one-at-a-time" | steering 消息投递方式 |
| `followUpMode` | "one-at-a-time" | follow-up 消息投递方式 |
| `transport` | "sse" | 传输偏好: sse/websocket/auto |

#### 终端与图片

| 设置 | 默认 | 说明 |
|------|------|------|
| `terminal.showImages` | true | 终端内显示图片 |
| `images.autoResize` | true | 自动缩放到 2000x2000 |
| `images.blockImages` | false | 阻止图片发送给 LLM |

#### Shell

| 设置 | 说明 |
|------|------|
| `shellPath` | 自定义 shell 路径 |
| `shellCommandPrefix` | 每条 bash 命令前缀（如启用 aliases） |

#### 模型循环

```json
{ "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"] }
```

#### 资源路径

| 设置 | 说明 |
|------|------|
| `packages` | npm/git 包列表 |
| `extensions` | 本地扩展路径 |
| `skills` | 本地技能路径 |
| `prompts` | 本地模板路径 |
| `themes` | 本地主题路径 |
| `enableSkillCommands` | 注册 `/skill:name` 命令 (默认 true) |

### 环境变量

| 变量 | 说明 |
|------|------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录 (默认 `~/.pi/agent`) |
| `PI_PACKAGE_DIR` | 覆盖包目录 |
| `PI_SKIP_VERSION_CHECK` | 跳过启动版本检查 |
| `PI_CACHE_RETENTION` | 设为 `long` 延长 prompt cache |
| `VISUAL`, `EDITOR` | Ctrl+G 外部编辑器 |

---

## 二、SDK（编程式使用）

### 快速开始

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@mariozechner/pi-coding-agent";

const authStorage = new AuthStorage();
const modelRegistry = new ModelRegistry(authStorage);

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("What files are in the current directory?");
```

### createAgentSession 选项

| 选项 | 说明 |
|------|------|
| `cwd` | 工作目录 |
| `agentDir` | 全局配置目录 |
| `model` | 指定模型 |
| `thinkingLevel` | thinking 级别 |
| `scopedModels` | Ctrl+P 循环模型列表 |
| `tools` | 内置工具集 |
| `customTools` | 自定义工具 |
| `resourceLoader` | 资源加载器 |
| `sessionManager` | 会话管理器 |
| `settingsManager` | 设置管理器 |
| `authStorage` | 认证存储 |
| `modelRegistry` | 模型注册表 |

### AgentSession API

| 方法 | 说明 |
|------|------|
| `prompt(text, opts)` | 发送 prompt |
| `steer(text)` | 中断式消息 |
| `followUp(text)` | 等待式消息 |
| `subscribe(listener)` | 订阅事件 |
| `setModel(model)` | 切换模型 |
| `newSession(opts)` | 新建会话 |
| `fork(entryId)` | Fork 会话 |
| `navigateTree(targetId, opts)` | 树导航 |
| `compact(instructions)` | 手动压缩 |
| `abort()` | 中止当前操作 |
| `dispose()` | 清理 |

### SessionManager 静态方法

| 方法 | 说明 |
|------|------|
| `SessionManager.create(cwd)` | 新建会话 |
| `SessionManager.open(path)` | 打开已有会话 |
| `SessionManager.continueRecent(cwd)` | 继续最近会话 |
| `SessionManager.inMemory()` | 内存会话（不持久化） |
| `SessionManager.list(cwd)` | 列出目录下会话 |
| `SessionManager.listAll()` | 列出所有会话 |

### 事件类型

| 事件 | 说明 |
|------|------|
| `message_update` | 流式文本/thinking/toolcall |
| `tool_execution_start/update/end` | 工具执行生命周期 |
| `agent_start/end` | Agent 生命周期 |
| `turn_start/end` | 轮次生命周期 |
| `message_start/end` | 消息生命周期 |
| `auto_compaction_start/end` | 自动压缩 |
| `auto_retry_start/end` | 自动重试 |

### 运行模式工具

| 类 | 说明 |
|---|------|
| `InteractiveMode` | 完整 TUI 交互模式 |
| `runPrintMode()` | 单次输出模式 |
| `runRpcMode()` | RPC 子进程模式 |

---

## 三、RPC 模式

通过 stdin/stdout JSON 协议实现无头操作。

```bash
pi --mode rpc [options]
```

### 命令列表

| 命令 | 说明 |
|------|------|
| `prompt` | 发送 prompt（支持 streamingBehavior: steer/followUp） |
| `steer` | 排队中断消息 |
| `follow_up` | 排队等待消息 |
| `abort` | 中止当前操作 |
| `new_session` | 新建会话 |
| `get_state` | 获取会话状态 |
| `get_messages` | 获取所有消息 |
| `set_model` | 切换模型 |
| `cycle_model` | 循环模型 |
| `get_available_models` | 列出可用模型 |
| `set_thinking_level` | 设置 thinking level |
| `compact` | 手动压缩 |
| `bash` | 执行 shell 命令 |
| `get_session_stats` | 获取 token/费用统计 |
| `export_html` | 导出 HTML |
| `switch_session` | 切换会话 |
| `fork` | Fork 会话 |
| `get_commands` | 获取可用命令 |
| `set_session_name` | 设置会话名 |

### Extension UI 子协议

扩展的 `ctx.ui.select/confirm/input/editor` 在 RPC 模式下转为 `extension_ui_request` / `extension_ui_response` 请求响应对。

`notify/setStatus/setWidget/setTitle/set_editor_text` 为 fire-and-forget，不需要响应。

---

## 四、TUI 组件系统

来自 `@mariozechner/pi-tui` 包。

### Component 接口

```typescript
interface Component {
  render(width: number): string[];  // 每行不超过 width
  handleInput?(data: string): void;
  invalidate(): void;
}
```

### 内置组件

| 组件 | 说明 |
|------|------|
| `Text` | 多行文本，自动换行 |
| `Box` | 带 padding 和背景色的容器 |
| `Container` | 垂直组合子组件 |
| `Spacer` | 空行 |
| `Markdown` | Markdown 渲染 + 语法高亮 |
| `Image` | 终端内图片渲染 |
| `SelectList` | 选择列表 |
| `SettingsList` | 设置切换列表 |
| `Input` | 文本输入 |
| `Editor` | 多行编辑器 |

### 键盘输入

```typescript
import { matchesKey, Key } from "@mariozechner/pi-tui";

if (matchesKey(data, Key.up)) { ... }
if (matchesKey(data, Key.enter)) { ... }
if (matchesKey(data, Key.ctrl("c"))) { ... }
```

### 常用模式

1. **SelectList + DynamicBorder** — 选择对话框
2. **BorderedLoader** — 异步操作 + 取消
3. **SettingsList** — 设置切换
4. **setStatus** — Footer 状态指示
5. **setWidget** — 编辑器上下方 widget
6. **setFooter** — 自定义 footer
7. **CustomEditor** — 自定义编辑器（如 Vim 模式）

### Overlay 模式

```typescript
ctx.ui.custom(component, {
  overlay: true,
  overlayOptions: {
    width: "50%", anchor: "center", margin: 2,
    visible: (w, h) => w >= 80,
  }
});
```

### 主题化

工具渲染中使用 `theme` 参数：
```typescript
theme.fg("success", "✓ Done")  // 前景色
theme.bg("toolSuccessBg", text) // 背景色
theme.bold("text")              // 粗体
```

---

## 五、自定义模型 (models.json)

`~/.pi/agent/models.json`，编辑后无需重启，打开 `/model` 时自动重载。

### 最简示例（Ollama）

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

### 支持的 API 类型

| API | 用途 |
|-----|------|
| `openai-completions` | OpenAI Chat Completions（最通用） |
| `openai-responses` | OpenAI Responses API |
| `anthropic-messages` | Anthropic Messages API |
| `google-generative-ai` | Google Generative AI |
| `bedrock-converse-stream` | Amazon Bedrock |

### 覆盖内置提供商

仅改 baseUrl（保留所有内置模型）：
```json
{ "providers": { "anthropic": { "baseUrl": "https://my-proxy.com/v1" } } }
```

### 自定义提供商（Extension）

```typescript
pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com",
  apiKey: "MY_API_KEY",
  api: "openai-completions",
  models: [{ id: "my-model", name: "My Model", reasoning: false, input: ["text"], ... }],
  oauth: { name: "My SSO", login(...) { ... }, refreshToken(...) { ... }, getApiKey(...) { ... } },
  streamSimple: myStreamFn, // 非标准 API 自定义流
});
```

---

## 六、Context Files

Pi 启动时加载 `AGENTS.md`（或 `CLAUDE.md`）：
- `~/.pi/agent/AGENTS.md` — 全局
- 从 cwd 向上遍历父目录
- 当前目录

### System Prompt 替换

- `.pi/SYSTEM.md` 或 `~/.pi/agent/SYSTEM.md` — 替换默认 system prompt
- `APPEND_SYSTEM.md` — 追加而不替换
