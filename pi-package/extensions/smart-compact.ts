/**
 * 智能压缩扩展 — 在发送给 LLM 前裁剪大块内容
 *
 * 策略：
 * 1. 工具输出超过阈值 → 保留首尾，中间替换为 "[...truncated N lines]"
 * 2. 用户粘贴的大块文本 → 同上
 * 3. 越旧的消息裁剪越激进
 */

const MAX_TOOL_OUTPUT_CHARS = 8000;
const MAX_USER_BLOCK_CHARS = 12000;
const KEEP_HEAD = 1500;
const KEEP_TAIL = 2500;

function truncateText(text: string, max: number, head = KEEP_HEAD, tail = KEEP_TAIL): string {
  if (text.length <= max) return text;
  const lines = text.split("\n");
  if (lines.length <= 10) return text; // 短文本不裁
  const headText = text.slice(0, head);
  const tailText = text.slice(-tail);
  const removedLines = text.slice(head, -tail).split("\n").length;
  return `${headText}\n\n[...truncated ${removedLines} lines...]\n\n${tailText}`;
}

function compactContent(content: any): any {
  if (typeof content === "string") {
    return truncateText(content, MAX_TOOL_OUTPUT_CHARS);
  }
  if (!Array.isArray(content)) return content;
  return content.map((block: any) => {
    if (block.type === "text" && typeof block.text === "string") {
      return { ...block, text: truncateText(block.text, MAX_TOOL_OUTPUT_CHARS) };
    }
    return block;
  });
}

export default function smartCompact(pi: any) {
  pi.on("context", async (event: any) => {
    const messages = event.messages;
    if (!messages || messages.length < 4) return; // 太短不处理

    // 只处理非最近 3 条消息（保留最近上下文完整）
    const cutoff = messages.length - 3;

    for (let i = 0; i < cutoff; i++) {
      const msg = messages[i];
      if (!msg) continue;

      if (msg.role === "toolResult") {
        msg.content = compactContent(msg.content);
      } else if (msg.role === "user") {
        // 用户消息用更宽松的阈值
        if (typeof msg.content === "string" && msg.content.length > MAX_USER_BLOCK_CHARS) {
          msg.content = truncateText(msg.content, MAX_USER_BLOCK_CHARS);
        } else if (Array.isArray(msg.content)) {
          msg.content = msg.content.map((block: any) => {
            if (block.type === "text" && typeof block.text === "string" && block.text.length > MAX_USER_BLOCK_CHARS) {
              return { ...block, text: truncateText(block.text, MAX_USER_BLOCK_CHARS) };
            }
            return block;
          });
        }
      } else if (msg.role === "assistant" && Array.isArray(msg.content)) {
        // 裁剪 assistant 的大块工具调用参数
        msg.content = msg.content.map((block: any) => {
          if (block.type === "toolCall" && block.arguments) {
            const args = JSON.stringify(block.arguments);
            if (args.length > MAX_TOOL_OUTPUT_CHARS) {
              try {
                const parsed = typeof block.arguments === "string" ? JSON.parse(block.arguments) : block.arguments;
                // 裁剪大字符串参数
                for (const key of Object.keys(parsed)) {
                  if (typeof parsed[key] === "string" && parsed[key].length > MAX_TOOL_OUTPUT_CHARS) {
                    parsed[key] = truncateText(parsed[key], MAX_TOOL_OUTPUT_CHARS);
                  }
                }
                return { ...block, arguments: parsed };
              } catch { return block; }
            }
          }
          return block;
        });
      }
    }

    return { messages };
  });
}
