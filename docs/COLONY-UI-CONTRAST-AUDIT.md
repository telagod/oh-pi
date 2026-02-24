# Colony UI Contrast Audit（首轮）

> 目标：避免关键信息使用过暗色阶导致“看不清、找不到重点”。

## 1) 色阶语义（统一规范）

- `text`：主信息（阶段、任务标题、日志正文）
- `muted`：次信息（目标摘要、时间戳、辅助说明）
- `dim`：弱提示（装饰符号、极低优先级元数据）

结论：**关键状态与关键进度不再使用 `dim`**。

---

## 2) 本轮调整范围

文件：`pi-package/extensions/ant-colony/index.ts`

已调整：
- 报告任务行从 `dim` -> `muted`
- Active Streams 的 antId 从 `dim` -> `muted`
- Recent Signals 的 age 时间从 `dim` -> `muted`
- tool call/launch 结果中的 Goal 与摘要从 `dim` -> `muted`

保留 `dim` 的场景：
- 任务列表中的 pending 圆点 `○`
- 任务耗时尾缀（duration）

理由：这些信息是“可看可不看”的弱提示，不影响主判断。

---

## 3) 体验验收标准

- 用户 3 秒内能看清：阶段、进度、是否失败。
- 在暗色主题下，不需要“凑近看”才能识别状态条。
- `dim` 不再承载核心语义。

---

## 4) 后续（第二轮）

- 对 six themes 做截图式人工巡检（oh-pi Dark / Cyberpunk / Nord / Catppuccin / Tokyo Night / Gruvbox）。
- 若主题 `muted` 仍偏暗，考虑在 extension 内对关键行强制使用 `text`。
