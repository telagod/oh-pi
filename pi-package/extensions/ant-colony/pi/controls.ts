import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { BackgroundColony } from "./ui.js";

export interface RegisterStatusControlsDeps {
  getActiveColony(): BackgroundColony | null;
  getStatusText(): string;
  isExplicitStatusRequest(ctx: any): boolean;
  getLastSnapshotAt(): number;
  setLastSnapshotAt(ts: number): void;
  statusSnapshotCooldownMs: number;
  stopActiveColony(): void;
  resumeColony(ctx: any): Promise<boolean> | boolean;
}

export function registerStatusControls(pi: ExtensionAPI, deps: RegisterStatusControlsDeps) {
  pi.registerTool({
    name: "bg_colony_status",
    label: "Colony Status",
    description: "Optional manual snapshot for a running colony. Progress is pushed passively via COLONY_SIGNAL follow-up messages; call this only when the user explicitly asks.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      if (!deps.getActiveColony()) {
        return { content: [{ type: "text" as const, text: "No colony is currently running." }] };
      }
      const explicit = deps.isExplicitStatusRequest(ctx);
      if (!explicit) {
        return {
          content: [{ type: "text" as const, text: "Passive mode is active. Colony progress is already pushed via [COLONY_SIGNAL:*] follow-up messages. Skipping bg_colony_status polling to avoid blocking the main process. Ask explicitly for a manual snapshot if needed." }],
          isError: true,
        };
      }
      const now = Date.now();
      const delta = now - deps.getLastSnapshotAt();
      if (delta < deps.statusSnapshotCooldownMs) {
        const waitSec = Math.ceil((deps.statusSnapshotCooldownMs - delta) / 1000);
        return {
          content: [{ type: "text" as const, text: `Manual status snapshot is rate-limited. Please wait ${waitSec}s to avoid active polling loops.` }],
          isError: true,
        };
      }
      deps.setLastSnapshotAt(now);
      return { content: [{ type: "text" as const, text: deps.getStatusText() }] };
    },
  });

  pi.registerCommand("colony-status", {
    description: "Show current colony progress",
    async handler(_args, ctx) {
      if (!deps.getActiveColony()) {
        ctx.ui.notify("No colony is currently running.", "info");
        return;
      }
      ctx.ui.notify(deps.getStatusText(), "info");
    },
  });

  pi.registerCommand("colony-stop", {
    description: "Stop the running background colony",
    async handler(_args, ctx) {
      if (!deps.getActiveColony()) {
        ctx.ui.notify("No colony is currently running.", "info");
        return;
      }
      deps.stopActiveColony();
      ctx.ui.notify("🐜 Colony abort signal sent. Waiting for ants to finish...", "warning");
    },
  });

  pi.registerCommand("colony-resume", {
    description: "Resume a colony from its last checkpoint",
    async handler(_args, ctx) {
      if (deps.getActiveColony()) {
        ctx.ui.notify("A colony is already running.", "warning");
        return;
      }
      const resumed = await deps.resumeColony(ctx);
      if (!resumed) ctx.ui.notify("No resumable colony found.", "info");
    },
  });
}
