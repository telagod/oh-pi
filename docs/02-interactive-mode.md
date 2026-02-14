# Pi Interactive Mode 详解

## 一、界面布局（从上到下）

1. **Startup Header** — 快捷键、加载的 AGENTS.md、Prompt Templates、Skills、Extensions
2. **Messages** — 用户消息、助手回复、工具调用/结果、通知、错误、扩展 UI
3. **Editor** — 输入区域，边框颜色指示 thinking level
4. **Footer** — 工作目录、会话名、Token/缓存用量、费用、上下文使用率、当前模型

## 二、编辑器功能

| 功能 | 操作 |
|------|------|
| 文件引用 | 输入 `@` 模糊搜索项目文件 |
| 路径补全 | Tab 补全路径 |
| 多行输入 | Shift+Enter (Windows Terminal: Ctrl+Enter) |
| 图片粘贴 | Ctrl+V 或拖拽到终端 |
| Bash 命令 | `!command` 运行并发送输出给 LLM，`!!command` 运行但不发送 |

## 三、命令系统

输入 `/` 触发命令。Extensions 可注册自定义命令，Skills 通过 `/skill:name` 调用，Prompt Templates 通过 `/templatename` 展开。

### 内置命令

| 命令 | 说明 |
|------|------|
| `/login`, `/logout` | OAuth 认证 |
| `/model` | 切换模型 |
| `/scoped-models` | 启用/禁用 Ctrl+P 循环的模型 |
| `/settings` | thinking level、主题、消息投递、传输方式 |
| `/resume` | 从历史会话中选择恢复 |
| `/new` | 新建会话 |
| `/name <name>` | 设置会话显示名 |
| `/session` | 显示会话信息（路径、token、费用） |
| `/tree` | 跳转到会话树任意节点并从该处继续 |
| `/fork` | 从当前分支创建新会话文件 |
| `/compact [prompt]` | 手动压缩上下文 |
| `/copy` | 复制最后一条助手消息到剪贴板 |
| `/export [file]` | 导出会话为 HTML |
| `/share` | 上传为 GitHub Gist |
| `/reload` | 重载 Extensions、Skills、Prompts、Context Files |
| `/hotkeys` | 显示所有快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit`, `/exit` | 退出 |

## 四、常用快捷键

| 键 | 动作 |
|----|------|
| Ctrl+C | 清空编辑器 |
| Ctrl+C 两次 | 退出 |
| Escape | 取消/中止 |
| Escape 两次 | 打开 `/tree` |
| Ctrl+L | 打开模型选择器 |
| Ctrl+P / Shift+Ctrl+P | 循环切换模型 |
| Shift+Tab | 循环 thinking level |
| Ctrl+O | 折叠/展开工具输出 |
| Ctrl+T | 折叠/展开 thinking blocks |
| Alt+Enter | 排队 follow-up 消息 |
| Alt+Up | 取回排队消息到编辑器 |

### 自定义快捷键

编辑 `~/.pi/agent/keybindings.json`：

```json
{
  "cursorUp": ["up", "ctrl+p"],
  "cursorDown": ["down", "ctrl+n"],
  "selectModel": "ctrl+l"
}
```

每个 action 可绑定单个键或键数组。支持 `ctrl`, `shift`, `alt` 修饰符组合。

### 完整 Action 列表

**光标移动**: cursorUp, cursorDown, cursorLeft, cursorRight, cursorWordLeft, cursorWordRight, cursorLineStart, cursorLineEnd, jumpForward, jumpBackward, pageUp, pageDown

**删除**: deleteCharBackward, deleteCharForward, deleteWordBackward, deleteWordForward, deleteToLineStart, deleteToLineEnd

**输入**: newLine, submit, tab

**Kill Ring**: yank, yankPop, undo

**剪贴板**: copy, pasteImage

**应用**: interrupt, clear, exit, suspend, externalEditor

**会话**: newSession, tree, fork, resume

**模型**: selectModel, cycleModelForward, cycleModelBackward, cycleThinkingLevel

**显示**: expandTools, toggleThinking

**消息队列**: followUp, dequeue

## 五、消息队列

在 Agent 工作时可提交消息：

- **Enter** — 排队 steering 消息，当前工具执行完后投递（中断剩余工具）
- **Alt+Enter** — 排队 follow-up 消息，Agent 完成所有工作后才投递
- **Escape** — 中止并恢复排队消息到编辑器
- **Alt+Up** — 取回排队消息到编辑器

### 投递模式配置

| 设置 | 默认 | 说明 |
|------|------|------|
| `steeringMode` | `"one-at-a-time"` | steering 消息投递方式 |
| `followUpMode` | `"one-at-a-time"` | follow-up 消息投递方式 |
| `transport` | `"sse"` | 传输偏好: `"sse"`, `"websocket"`, `"auto"` |

## 六、终端兼容性

### 开箱即用
- Kitty, iTerm2

### 需要配置
- **Ghostty**: 需添加 keybind 配置
- **WezTerm**: 需启用 `enable_kitty_keyboard`
- **VS Code Terminal**: 需添加 Shift+Enter keybinding
- **Windows Terminal**: 需添加 Shift+Enter action
- **IntelliJ IDEA**: 有限支持，建议用独立终端

### 图片支持
支持 Kitty、iTerm2、Ghostty、WezTerm 终端内显示图片。

### 颜色
使用 24-bit RGB 颜色。旧终端自动降级到 256 色近似。
