import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { calcProgress, type BackgroundColony } from "./ui.js";
import { formatCost, formatDuration, statusIcon, statusLabel } from "../core/ui.js";

export interface ColonyStateAccess {
  getActiveColony(): BackgroundColony | null;
  setActiveColony(colony: BackgroundColony | null): void;
}

export function createThrottledRender(pi: ExtensionAPI): () => void {
  let lastRender = 0;
  return () => {
    const now = Date.now();
    if (now - lastRender < 500) return;
    lastRender = now;
    pi.events.emit("ant-colony:render");
  };
}

export function registerColonySessionLifecycle(
  pi: ExtensionAPI,
  access: ColonyStateAccess,
) {
  let renderHandler: (() => void) | null = null;
  let clearHandler: (() => void) | null = null;
  let notifyHandler: ((data: { msg: string; level: "info" | "success" | "warning" | "error" }) => void) | null = null;

  pi.on("session_start", async (_event, ctx) => {
    if (renderHandler) pi.events.off("ant-colony:render", renderHandler);
    if (clearHandler) pi.events.off("ant-colony:clear-ui", clearHandler);
    if (notifyHandler) pi.events.off("ant-colony:notify", notifyHandler);

    renderHandler = () => {
      const activeColony = access.getActiveColony();
      if (!activeColony) return;
      const { state } = activeColony;
      const elapsed = state ? formatDuration(Date.now() - state.createdAt) : "0s";
      const m = state?.metrics;
      const phase = state?.status || "scouting";
      const progress = calcProgress(m);
      const pct = `${Math.round(progress * 100)}%`;
      const active = activeColony.antStreams.size;

      const parts = [`🐜 ${statusIcon(phase)} ${statusLabel(phase)}`];
      parts.push(m ? `${m.tasksDone}/${m.tasksTotal} (${pct})` : `0/0 (${pct})`);
      parts.push(`⚡${active}`);
      if (m) parts.push(formatCost(m.totalCost));
      parts.push(elapsed);

      ctx.ui.setStatus("ant-colony", parts.join(" │ "));
    };
    clearHandler = () => {
      ctx.ui.setStatus("ant-colony", undefined);
    };
    notifyHandler = (data) => {
      ctx.ui.notify(data.msg, data.level);
    };

    pi.events.on("ant-colony:render", renderHandler);
    pi.events.on("ant-colony:clear-ui", clearHandler);
    pi.events.on("ant-colony:notify", notifyHandler);
  });

  pi.on("session_shutdown", async () => {
    const activeColony = access.getActiveColony();
    if (activeColony) {
      activeColony.abortController.abort();
      try {
        await Promise.race([
          activeColony.promise,
          new Promise((r) => setTimeout(r, 5000)),
        ]);
      } catch {
        // ignore
      }
      pi.events.emit("ant-colony:clear-ui");
      access.setActiveColony(null);
    }
  });
}
