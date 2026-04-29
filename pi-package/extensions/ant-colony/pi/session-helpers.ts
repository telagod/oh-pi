export function extractMessageText(message: any): string {
  const c = message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c.map((p: any) => {
      if (typeof p === "string") return p;
      if (typeof p?.text === "string") return p.text;
      if (typeof p?.content === "string") return p.content;
      return "";
    }).join("\n");
  }
  return "";
}

export function lastUserMessageText(ctx: any): string {
  try {
    const branch = ctx?.sessionManager?.getBranch?.() ?? [];
    for (let i = branch.length - 1; i >= 0; i--) {
      const e = branch[i];
      if (e?.type === "message" && e.message?.role === "user") {
        return extractMessageText(e.message).trim();
      }
    }
  } catch {
    // ignore
  }
  return "";
}

export function isExplicitStatusRequest(ctx: any): boolean {
  const text = lastUserMessageText(ctx);
  return /(?:\/colony-status|bg_colony_status)|(?:(?:蚁群|colony).{0,20}(?:状态|进度|进展|汇报|快照|status|progress|snapshot|update|check))|(?:(?:状态|进度|进展|汇报|快照|status|progress|snapshot|update|check).{0,20}(?:蚁群|colony))/i.test(text);
}
