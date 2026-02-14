# Pi 扩展系统 (Extensions)

## 一、概述

Extensions 是 TypeScript 模块，通过 jiti 加载（无需编译）。可以：
- 注册自定义工具（LLM 可调用）
- 拦截/修改工具调用和结果
- 注册命令、快捷键、CLI flags
- 用户交互（对话框、通知、自定义 UI 组件）
- 自定义渲染（工具调用/结果、消息）
- 会话状态持久化
- 替换内置工具
- 注册自定义模型提供商

## 二、放置位置

| 位置 | 范围 |
|------|------|
| `~/.pi/agent/extensions/*.ts` | 全局 |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目级 |
| `.pi/extensions/*/index.ts` | 项目级（子目录） |
| `settings.json` 的 `extensions` 数组 | 额外路径 |
| `pi -e ./path.ts` | 临时加载（快速测试） |

## 三、基本结构

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // 订阅事件
  pi.on("event_name", async (event, ctx) => { ... });

  // 注册工具
  pi.registerTool({ name: "my_tool", ... });

  // 注册命令
  pi.registerCommand("name", { handler: async (args, ctx) => { ... } });

  // 注册快捷键
  pi.registerShortcut("ctrl+shift+p", { handler: async (ctx) => { ... } });
}
```

### 可用导入

| 包 | 用途 |
|---|------|
| `@mariozechner/pi-coding-agent` | Extension 类型 |
| `@sinclair/typebox` | 工具参数 Schema |
| `@mariozechner/pi-ai` | AI 工具（StringEnum 等） |
| `@mariozechner/pi-tui` | TUI 组件 |
| Node.js 内置模块 | `node:fs`, `node:path` 等 |
| npm 依赖 | 需在扩展目录放 package.json 并 npm install |

## 四、事件生命周期

```
pi 启动 → session_start
用户发送 prompt:
  → input (可拦截/转换)
  → before_agent_start (可注入消息/修改 system prompt)
  → agent_start
  → message_start / message_update / message_end
  → [turn 循环]:
      turn_start → context → tool_call → tool_execution_* → tool_result → turn_end
  → agent_end
模型切换 → model_select
会话操作 → session_before_switch/switch, session_before_fork/fork
压缩 → session_before_compact/compact
树导航 → session_before_tree/tree
退出 → session_shutdown
```

### 关键事件

| 事件 | 可返回 | 用途 |
|------|--------|------|
| `tool_call` | `{ block: true, reason }` | 拦截危险操作 |
| `tool_result` | `{ content, details, isError }` | 修改工具结果 |
| `input` | `{ action: "transform"/"handled"/"continue" }` | 拦截/转换用户输入 |
| `before_agent_start` | `{ message, systemPrompt }` | 注入消息/修改 system prompt |
| `context` | `{ messages }` | 修改发送给 LLM 的消息 |
| `session_before_compact` | `{ cancel }` 或 `{ compaction }` | 自定义压缩 |
| `session_before_tree` | `{ cancel }` 或 `{ summary }` | 自定义分支摘要 |

## 五、ExtensionAPI 方法

### 核心

| 方法 | 说明 |
|------|------|
| `pi.on(event, handler)` | 订阅事件 |
| `pi.registerTool(def)` | 注册自定义工具 |
| `pi.registerCommand(name, opts)` | 注册 `/command` |
| `pi.registerShortcut(key, opts)` | 注册快捷键 |
| `pi.registerFlag(name, opts)` | 注册 CLI flag |
| `pi.registerProvider(name, config)` | 注册/覆盖模型提供商 |
| `pi.registerMessageRenderer(type, renderer)` | 自定义消息渲染 |

### 消息注入

| 方法 | 说明 |
|------|------|
| `pi.sendMessage(msg, opts)` | 注入自定义消息（steer/followUp/nextTurn） |
| `pi.sendUserMessage(content, opts)` | 发送用户消息 |
| `pi.appendEntry(type, data)` | 持久化扩展状态（不参与 LLM 上下文） |

### 工具管理

| 方法 | 说明 |
|------|------|
| `pi.getActiveTools()` | 获取当前活跃工具 |
| `pi.getAllTools()` | 获取所有工具 |
| `pi.setActiveTools(names)` | 设置活跃工具 |

### 模型控制

| 方法 | 说明 |
|------|------|
| `pi.setModel(model)` | 设置模型 |
| `pi.getThinkingLevel()` | 获取 thinking level |
| `pi.setThinkingLevel(level)` | 设置 thinking level |

### 其他

| 方法 | 说明 |
|------|------|
| `pi.exec(cmd, args, opts)` | 执行 shell 命令 |
| `pi.events` | 扩展间事件总线 |
| `pi.setSessionName(name)` | 设置会话名 |
| `pi.setLabel(entryId, label)` | 设置/清除条目标签 |
| `pi.getCommands()` | 获取可用命令列表 |

## 六、ExtensionContext (ctx)

每个事件处理器接收 `ctx`：

| 属性/方法 | 说明 |
|-----------|------|
| `ctx.ui` | UI 交互方法 |
| `ctx.hasUI` | 是否有 UI（print/json 模式为 false） |
| `ctx.cwd` | 当前工作目录 |
| `ctx.sessionManager` | 只读会话状态 |
| `ctx.modelRegistry` / `ctx.model` | 模型访问 |
| `ctx.isIdle()` / `ctx.abort()` | 控制流 |
| `ctx.shutdown()` | 请求优雅关闭 |
| `ctx.getContextUsage()` | 上下文使用情况 |
| `ctx.compact(opts)` | 触发压缩 |
| `ctx.getSystemPrompt()` | 获取当前 system prompt |

### ExtensionCommandContext（命令处理器额外方法）

| 方法 | 说明 |
|------|------|
| `ctx.waitForIdle()` | 等待 Agent 空闲 |
| `ctx.newSession(opts)` | 创建新会话 |
| `ctx.fork(entryId)` | Fork 会话 |
| `ctx.navigateTree(targetId, opts)` | 树导航 |
| `ctx.reload()` | 重载资源 |

## 七、自定义工具

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "工具描述（LLM 可见）",
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const), // Google 兼容
    text: Type.Optional(Type.String()),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });
    return {
      content: [{ type: "text", text: "Done" }],
      details: { result: "..." },
    };
  },
  renderCall(args, theme) { ... },    // 可选：自定义渲染
  renderResult(result, opts, theme) { ... },
});
```

**重要**: 枚举用 `StringEnum`（不是 `Type.Union`），否则 Google API 不兼容。

### 输出截断

内置限制: 50KB / 2000 行。自定义工具必须自行截断输出。使用导出的工具函数：
- `truncateHead(output, opts)` — 保留开头
- `truncateTail(output, opts)` — 保留结尾

### 覆盖内置工具

注册同名工具即可覆盖 `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`。

### 远程执行

内置工具支持可插拔 Operations 接口，可委托到 SSH/容器等远程系统。

## 八、UI 交互

### 对话框

```typescript
const choice = await ctx.ui.select("标题", ["A", "B", "C"]);
const ok = await ctx.ui.confirm("删除?", "不可撤销");
const name = await ctx.ui.input("名称:", "placeholder");
const text = await ctx.ui.editor("编辑:", "预填内容");
ctx.ui.notify("完成!", "info"); // "info" | "warning" | "error"
```

支持 `timeout` 选项自动倒计时关闭。

### 持久化 UI

```typescript
ctx.ui.setStatus("key", "文本");           // Footer 状态
ctx.ui.setWidget("key", ["行1", "行2"]);   // 编辑器上方 widget
ctx.ui.setWidget("key", lines, { placement: "belowEditor" }); // 下方
ctx.ui.setFooter((tui, theme, data) => ({ ... })); // 自定义 footer
ctx.ui.setEditorComponent((tui, theme, kb) => new VimEditor(...)); // 自定义编辑器
```

### 自定义组件

```typescript
const result = await ctx.ui.custom<T>((tui, theme, keybindings, done) => {
  return { render(w) { ... }, invalidate() { ... }, handleInput(data) { ... } };
}, { overlay: true }); // overlay 模式可选
```

## 九、状态管理

扩展状态应存储在工具结果的 `details` 中，以支持分支：

```typescript
// 从会话重建状态
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "toolResult"
        && entry.message.toolName === "my_tool") {
      state = entry.message.details?.state;
    }
  }
});
```

## 十、示例扩展索引

| 扩展 | 功能 |
|------|------|
| `hello.ts` | 最简示例 |
| `confirm-destructive.ts` | 危险命令确认 |
| `protected-paths.ts` | 路径保护 |
| `git-checkpoint.ts` | Git 检查点 |
| `auto-commit-on-exit.ts` | 退出时自动提交 |
| `permission-gate.ts` | 权限门控 |
| `tool-override.ts` | 覆盖内置工具 |
| `custom-compaction.ts` | 自定义压缩 |
| `plan-mode/` | 计划模式 |
| `subagent/` | 子代理系统 |
| `ssh.ts` | SSH 远程执行 |
| `sandbox/` | 沙箱执行 |
| `snake.ts` | 贪吃蛇游戏 |
| `doom-overlay/` | Doom 游戏 |
| `modal-editor.ts` | Vim 模式编辑器 |
| `todo.ts` | Todo 列表工具 |
| `preset.ts` | 预设切换 |
| `pirate.ts` | 海盗语气 |
| `claude-rules.ts` | Claude 规则兼容 |
| `custom-provider-*` | 自定义提供商示例 |
