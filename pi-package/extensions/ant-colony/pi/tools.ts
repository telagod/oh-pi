import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, Container } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import type { BackgroundColony } from "./ui.js";

export interface RegisterAntColonyToolDeps {
  getActiveColony(): BackgroundColony | null;
  runSyncColony(params: { goal: string; maxAnts?: number; maxCost?: number; currentModel: string; modelOverrides: Record<string, string>; cwd: string; modelRegistry?: any; }, signal?: AbortSignal | null): Promise<any>;
  launchBackgroundColony(params: { goal: string; maxAnts?: number; maxCost?: number; currentModel: string; modelOverrides: Record<string, string>; cwd: string; modelRegistry?: any; }): void;
}

export function registerAntColonyTool(pi: ExtensionAPI, deps: RegisterAntColonyToolDeps) {
  pi.registerTool({
    name: "ant_colony",
    label: "Ant Colony",
    description: [
      "Launch an autonomous ant colony in the BACKGROUND to accomplish a complex goal.",
      "The colony runs asynchronously — you can continue chatting while it works.",
      "Results are automatically injected when the colony finishes.",
      "Scouts explore the codebase, workers execute tasks in parallel, soldiers review quality.",
      "Use for multi-file changes, large refactors, or complex features.",
    ].join(" "),
    parameters: Type.Object({
      goal: Type.String({ description: "What the colony should accomplish" }),
      maxAnts: Type.Optional(Type.Number({ description: "Max concurrent ants (default: auto-adapt)", minimum: 1, maximum: 8 })),
      maxCost: Type.Optional(Type.Number({ description: "Max cost budget in USD (default: unlimited)", minimum: 0.01 })),
      scoutModel: Type.Optional(Type.String({ description: "Model for scout ants (default: current session model)" })),
      workerModel: Type.Optional(Type.String({ description: "Model for worker ants (default: current session model)" })),
      soldierModel: Type.Optional(Type.String({ description: "Model for soldier ants (default: current session model)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (deps.getActiveColony()) {
        return { content: [{ type: "text", text: "A colony is already running in the background. Use /colony-stop to cancel it first." }], isError: true };
      }
      const currentModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : null;
      if (!currentModel) {
        return { content: [{ type: "text", text: "Colony failed: no model available in current session" }], isError: true };
      }
      const modelOverrides: Record<string, string> = {};
      if (params.scoutModel) modelOverrides.scout = params.scoutModel;
      if (params.workerModel) modelOverrides.worker = params.workerModel;
      if (params.soldierModel) modelOverrides.soldier = params.soldierModel;
      const colonyParams = { goal: params.goal, maxAnts: params.maxAnts, maxCost: params.maxCost, currentModel, modelOverrides, cwd: ctx.cwd, modelRegistry: ctx.modelRegistry ?? undefined };
      if (!ctx.hasUI) return await deps.runSyncColony(colonyParams, _signal);
      deps.launchBackgroundColony(colonyParams);
      return { content: [{ type: "text", text: `[COLONY_SIGNAL:LAUNCHED]\n🐜 Colony launched in background.\nGoal: ${params.goal}\n\nThe colony runs autonomously in passive mode. Progress is pushed via [COLONY_SIGNAL:*] follow-up messages. Do not poll bg_colony_status unless the user explicitly asks for a manual snapshot.` }] };
    },
    renderCall(args, theme) {
      const goal = args.goal?.length > 70 ? args.goal.slice(0, 67) + "..." : args.goal;
      let text = theme.fg("toolTitle", theme.bold("🐜 ant_colony"));
      if (args.maxAnts) text += theme.fg("muted", ` ×${args.maxAnts}`);
      if (args.maxCost) text += theme.fg("warning", ` $${args.maxCost}`);
      text += "\n" + theme.fg("muted", `  ${goal || "..."}`);
      return new Text(text, 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      const text = result.content?.find((c: any) => c.type === "text")?.text || "";
      if (result.isError) return new Text(theme.fg("error", text), 0, 0);
      const container = new Container();
      container.addChild(new Text(theme.fg("success", "✓ ") + theme.fg("toolTitle", theme.bold("Colony launched in background")), 0, 0));
      const activeColony = deps.getActiveColony();
      if (activeColony) {
        container.addChild(new Text(theme.fg("muted", `  Goal: ${activeColony.goal.slice(0, 70)}`), 0, 0));
        container.addChild(new Text(theme.fg("muted", `  Ctrl+Shift+A for details │ /colony-stop to cancel`), 0, 0));
      }
      return container;
    },
  });
}
