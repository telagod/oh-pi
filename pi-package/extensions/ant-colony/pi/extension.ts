import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Spacer } from "@mariozechner/pi-tui";
import { runSyncColony } from "./runtime.js";
import { registerColonyRenderers } from "./renderers.js";
import { registerStatusControls } from "./controls.js";
import { registerAntColonyTool } from "./tools.js";
import { registerColonyShortcuts } from "./shortcuts.js";
import { isExplicitStatusRequest } from "./session-helpers.js";
import { createThrottledRender, registerColonySessionLifecycle } from "./lifecycle.js";
import { createColonyController } from "./controller.js";

export function createAntColonyExtension(pi: ExtensionAPI) {
  const STATUS_SNAPSHOT_COOLDOWN_MS = 15_000;

  const throttledRender = createThrottledRender(pi);
  const controller = createColonyController(pi, throttledRender);

  registerColonySessionLifecycle(pi, {
    getActiveColony: controller.getActiveColony,
    setActiveColony: controller.setActiveColony,
  });

  registerColonyRenderers(pi);
  registerColonyShortcuts(pi, controller.getActiveColony);

  registerAntColonyTool(pi, {
    getActiveColony: controller.getActiveColony,
    runSyncColony,
    launchBackgroundColony: (colonyParams) => {
      controller.launch(colonyParams);
    },
  });

  registerStatusControls(pi, {
    getActiveColony: controller.getActiveColony,
    getStatusText: controller.getStatusText,
    isExplicitStatusRequest,
    getLastSnapshotAt: controller.getLastSnapshotAt,
    setLastSnapshotAt: controller.setLastSnapshotAt,
    statusSnapshotCooldownMs: STATUS_SNAPSHOT_COOLDOWN_MS,
    stopActiveColony: controller.stopActiveColony,
    resumeColony: controller.resumeFromCheckpoint,
  });

  return {
    renderStatus(_messages: any[], _theme: any) {
      const activeColony = controller.getActiveColony();
      if (!activeColony) return null;
      return new Spacer(0, 0);
    },
  };
}
