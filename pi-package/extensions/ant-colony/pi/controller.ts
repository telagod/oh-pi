import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Nest } from "../core/nest.js";
import type { BackgroundColony } from "./ui.js";
import { buildStatusText } from "./ui.js";
import { launchBackgroundColony, type ColonyLaunchParams } from "./runtime.js";

export interface ColonyController {
  getActiveColony(): BackgroundColony | null;
  setActiveColony(colony: BackgroundColony | null): void;
  getLastSnapshotAt(): number;
  setLastSnapshotAt(ts: number): void;
  resetStatusSnapshotCooldown(): void;
  stopActiveColony(): void;
  getStatusText(): string;
  launch(params: ColonyLaunchParams, resume?: boolean): void;
  resumeFromCheckpoint(ctx: any): Promise<boolean>;
}

export function createColonyController(
  pi: ExtensionAPI,
  throttledRender: () => void,
): ColonyController {
  let activeColony: BackgroundColony | null = null;
  let lastBgStatusSnapshotAt = 0;

  const launch = (params: ColonyLaunchParams, resume = false) => {
    launchBackgroundColony(params, {
      pi,
      activeColony,
      setActiveColony(colony) { activeColony = colony; },
      resetStatusSnapshotCooldown() { lastBgStatusSnapshotAt = 0; },
      throttledRender,
    }, resume);
  };

  return {
    getActiveColony() { return activeColony; },
    setActiveColony(colony) { activeColony = colony; },
    getLastSnapshotAt() { return lastBgStatusSnapshotAt; },
    setLastSnapshotAt(ts) { lastBgStatusSnapshotAt = ts; },
    resetStatusSnapshotCooldown() { lastBgStatusSnapshotAt = 0; },
    stopActiveColony() { activeColony?.abortController.abort(); },
    getStatusText() { return buildStatusText(activeColony); },
    launch,
    async resumeFromCheckpoint(ctx: any) {
      const found = Nest.findResumable(ctx.cwd);
      if (!found) return false;
      ctx.ui.notify(`🐜 Resuming colony: ${found.state.goal.slice(0, 60)}...`, "info");
      launch({
        cwd: ctx.cwd,
        goal: found.state.goal,
        maxCost: found.state.maxCost ?? undefined,
        currentModel: ctx.currentModel,
        modelOverrides: {},
        modelRegistry: ctx.modelRegistry,
      }, true);
      return true;
    },
  };
}
