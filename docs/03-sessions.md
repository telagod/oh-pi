# Pi 会话管理

## 一、会话存储

会话以 JSONL（JSON Lines）文件存储，采用树结构。每个条目有 `id` 和 `parentId`，支持原地分支。

### 文件位置

```
~/.pi/agent/sessions/--<path>--/<timestamp>_<uuid>.jsonl
```

`<path>` 是工作目录，`/` 替换为 `-`。

### 会话版本

- **v1**: 线性序列（旧版，自动迁移）
- **v2**: 树结构 id/parentId
- **v3**: 当前版本，`hookMessage` 重命名为 `custom`

### 管理命令

```bash
pi -c                  # 继续最近会话
pi -r                  # 浏览选择历史会话
pi --no-session        # 临时模式（不保存）
pi --session <path>    # 使用指定会话文件或 ID
```

## 二、条目类型

### SessionHeader（文件首行，不参与树）

```json
{"type":"session","version":3,"id":"uuid","timestamp":"...","cwd":"/path"}
```

### SessionMessageEntry（对话消息）

包含 `AgentMessage`，类型有：
- `UserMessage` — 用户消息
- `AssistantMessage` — 助手回复（含 text/thinking/toolCall 内容块）
- `ToolResultMessage` — 工具执行结果
- `BashExecutionMessage` — 用户 `!` 命令执行结果
- `CustomMessage` — 扩展注入的消息（参与 LLM 上下文）
- `BranchSummaryMessage` — 分支摘要
- `CompactionSummaryMessage` — 压缩摘要

### ModelChangeEntry — 模型切换记录
### ThinkingLevelChangeEntry — thinking level 变更记录
### CompactionEntry — 上下文压缩记录
### BranchSummaryEntry — 分支切换摘要
### CustomEntry — 扩展状态持久化（不参与 LLM 上下文）
### CustomMessageEntry — 扩展消息（参与 LLM 上下文）
### LabelEntry — 书签/标记
### SessionInfoEntry — 会话元数据（显示名等）

## 三、树结构与分支

```
[user msg] ─── [assistant] ─── [user msg] ─── [assistant] ─┬─ [user msg] ← 当前叶节点
                                                            │
                                                            └─ [branch_summary] ─── [user msg] ← 备选分支
```

### /tree — 原地导航

在同一文件内切换分支，可选生成摘要。

| 键 | 动作 |
|----|------|
| ↑/↓ | 导航（深度优先） |
| Enter | 选择节点 |
| Escape | 取消 |
| Ctrl+U | 切换：仅用户消息 |
| Ctrl+O | 切换：显示全部 |

选择行为：
- 选择用户消息 → 叶节点设为其父节点，消息文本放入编辑器
- 选择非用户消息 → 叶节点设为选中节点，编辑器为空
- 选择根用户消息 → 叶节点重置为 null，从头开始

### /fork — 创建新会话文件

从当前分支提取路径到新文件。

| 特性 | /fork | /tree |
|------|-------|-------|
| 视图 | 用户消息平铺列表 | 完整树结构 |
| 动作 | 提取到新文件 | 同文件内切换叶节点 |
| 摘要 | 无 | 可选 |

## 四、上下文压缩 (Compaction)

### 触发条件

```
contextTokens > contextWindow - reserveTokens (默认 16384)
```

也可手动: `/compact [instructions]`

### 工作流程

1. 从最新消息向前走，累积 token 直到 `keepRecentTokens`（默认 20000）
2. 收集需要摘要的消息
3. 调用 LLM 生成结构化摘要
4. 追加 CompactionEntry
5. 会话重载，使用摘要 + firstKeptEntryId 之后的消息

### 摘要格式

```markdown
## Goal
[用户目标]

## Constraints & Preferences
- [用户要求]

## Progress
### Done / In Progress / Blocked

## Key Decisions
## Next Steps
## Critical Context

<read-files>...</read-files>
<modified-files>...</modified-files>
```

### 配置

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

## 五、分支摘要 (Branch Summarization)

`/tree` 切换分支时，可选摘要被放弃的分支。

流程：找到公共祖先 → 收集旧叶到祖先的条目 → LLM 生成摘要 → 追加 BranchSummaryEntry。

文件操作跟踪跨多次压缩/分支摘要累积。
