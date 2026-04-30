/**
 * 蚂蚁 Spawner — 每只蚂蚁通过 runtime adapter 驱动一个宿主 session
 *
 * 替代旧的 `pi --mode json` 子进程方案，同时避免 core 层直接依赖 Pi SDK：
 * - 零启动开销（同进程）
 * - 真实时 token 流（session.subscribe）
 * - 宿主 auth/model/tool 细节由 adapter 封装
 */

import type { Ant, AntConfig, Task, AntStreamEvent } from "./types.js";
import type { Nest } from "./nest.js";
import { CASTE_PROMPTS, buildPrompt } from "./prompts.js";
import { parseSubTasks, extractPheromones, type ParsedSubTask } from "./parser.js";
import type { AntRuntimeAdapter, AntRuntimeSession } from "./runtime.js";
import { makeAntId, makePheromoneId, makeTaskId } from "./ids.js";

export interface AntResult {
  ant: Ant;
  output: string;
  newTasks: ParsedSubTask[];
  pheromones: import("./types.js").Pheromone[];
  rateLimited: boolean;
}

export type { ParsedSubTask } from "./parser.js";
export { makeAntId, makePheromoneId, makeTaskId } from "./ids.js";

export async function runDrone(
  cwd: string,
  nest: Nest,
  task: Task,
): Promise<AntResult> {
  const antId = makeAntId("drone");
  const ant: Ant = {
    id: antId, caste: "drone", status: "working", taskId: task.id,
    pid: null, model: "none",
    usage: { input: 0, output: 0, cost: 0, turns: 1 },
    startedAt: Date.now(), finishedAt: null,
  };
  nest.updateAnt(ant);
  nest.updateTaskStatus(task.id, "active");

  try {
    const { execSync } = await import("node:child_process");
    const ctxMatch = task.context?.match(/```(?:bash|sh)?\s*\n?([\s\S]*?)```/);
    const cmd = ctxMatch?.[1]?.trim() || task.description;
    const DANGEROUS = /\brm\s+-rf\s+\/|mkfs\b|dd\s+if=|chmod\s+777\s+\/|>\s*\/dev\/sd/i;
    if (DANGEROUS.test(cmd)) {
      throw new Error(`Drone refused dangerous command: ${cmd.slice(0, 80)}`);
    }
    const output = execSync(cmd, { cwd, encoding: "utf-8", timeout: 30000, stdio: "pipe" }).trim();

    ant.status = "done";
    ant.finishedAt = Date.now();
    nest.updateAnt(ant);
    nest.updateTaskStatus(task.id, "done", `## Completed\n${output || "(no output)"}`);
    nest.dropPheromone({
      id: makePheromoneId(), type: "completion", antId, antCaste: "drone",
      taskId: task.id, content: `Drone executed: ${cmd.slice(0, 100)}`, files: task.files, strength: 1, createdAt: Date.now(),
    });
    return { ant, output, newTasks: [], pheromones: [], rateLimited: false };
  } catch (e: any) {
    const errStr = e.stderr?.toString() || String(e);
    ant.status = "failed";
    ant.finishedAt = Date.now();
    nest.updateAnt(ant);
    nest.updateTaskStatus(task.id, "failed", undefined, errStr.slice(0, 500));
    return { ant, output: errStr, newTasks: [], pheromones: [], rateLimited: false };
  }
}

export async function spawnAnt(
  cwd: string,
  nest: Nest,
  task: Task,
  antConfig: Omit<AntConfig, "systemPrompt">,
  signal?: AbortSignal,
  onStream?: (event: AntStreamEvent) => void,
  piAdapter?: AntRuntimeAdapter,
): Promise<AntResult> {
  if (!antConfig.model) throw new Error("No model resolved for ant");
  if (!piAdapter) throw new Error("No runtime adapter provided for ant");
  const antId = makeAntId(antConfig.caste);
  const ant: Ant = {
    id: antId,
    caste: antConfig.caste,
    status: "working",
    taskId: task.id,
    pid: null,
    model: antConfig.model,
    usage: { input: 0, output: 0, cost: 0, turns: 0 },
    startedAt: Date.now(),
    finishedAt: null,
  };

  nest.updateAnt(ant);
  nest.updateTaskStatus(task.id, "active");

  const warnings = nest.countWarnings(task.files);
  const difficultyTurns = Math.min(25, (antConfig.maxTurns || 15) + task.files.length + warnings * 2);
  const effectiveMaxTurns = antConfig.caste === "drone" ? 1 : difficultyTurns;

  const tandem: { parentResult?: string; priorError?: string } = {};
  if (task.parentId) {
    const parent = nest.getTask(task.parentId);
    if (parent?.result) tandem.parentResult = parent.result;
  }
  if (task.error) tandem.priorError = task.error;

  const pheromoneCtx = nest.getPheromoneContext(task.files);
  const castePrompt = CASTE_PROMPTS[antConfig.caste];
  const systemPrompt = buildPrompt(task, pheromoneCtx, castePrompt, effectiveMaxTurns, tandem);

  let accumulatedText = "";
  let session: AntRuntimeSession | null = null;

  try {
    session = await piAdapter.createSession({ cwd, model: antConfig.model, systemPrompt, toolNames: antConfig.tools });

    session.subscribe((event) => {
      if (event.type === "text_delta") {
        const delta = event.delta;
        accumulatedText += delta;
        onStream?.({ antId, caste: antConfig.caste, taskId: task.id, delta, totalText: accumulatedText });
      }

      if (event.type === "turn_end") {
        ant.usage.turns++;
        if (antConfig.caste === "scout" && accumulatedText) {
          const livePheromones = extractPheromones(antId, antConfig.caste, task.id, accumulatedText, task.files);
          for (const p of livePheromones) {
            p.id = makePheromoneId();
            nest.dropPheromone(p);
          }
        }
      }

      if (event.type === "assistant_message_end") {
        const u = event.usage;
        if (u) {
          ant.usage.input += u.input || 0;
          ant.usage.output += u.output || 0;
          ant.usage.cost += u.costTotal || 0;
        }
      }
    });

    const userPrompt = `Execute this task: ${task.title}\n\n${task.description}`;

    let onAbort: (() => void) | undefined;
    if (signal) {
      onAbort = () => session.abort();
      if (signal.aborted) {
        await session.abort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    try {
      await session.prompt(userPrompt);
    } finally {
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
    }

    const messages = session.getMessages();
    let finalOutput = accumulatedText;
    if (!finalOutput) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === "assistant") {
          for (const part of msg.content || []) {
            if (part.type === "text") {
              finalOutput = part.text || "";
              break;
            }
          }
          if (finalOutput) break;
        }
      }
    }

    ant.status = "done";
    ant.finishedAt = Date.now();
    nest.updateAnt(ant);

    const newTasks = parseSubTasks(finalOutput);
    const pheromones = extractPheromones(antId, antConfig.caste, task.id, finalOutput, task.files);
    for (const p of pheromones) nest.dropPheromone(p);

    nest.updateTaskStatus(task.id, "done", finalOutput);

    return { ant, output: finalOutput, newTasks, pheromones, rateLimited: false };
  } catch (e: any) {
    const errStr = String(e);
    const rateLimited = errStr.includes("429") || errStr.includes("rate limit") || errStr.includes("Rate limit");

    if (rateLimited) {
      nest.updateTaskStatus(task.id, "pending");
      ant.status = "failed";
      ant.finishedAt = Date.now();
      nest.updateAnt(ant);
      return { ant, output: accumulatedText, newTasks: [], pheromones: [], rateLimited: true };
    }

    ant.status = "failed";
    ant.finishedAt = Date.now();
    nest.updateAnt(ant);

    const newTasks = parseSubTasks(accumulatedText);
    const pheromones = extractPheromones(antId, antConfig.caste, task.id, accumulatedText, task.files, true);
    for (const p of pheromones) nest.dropPheromone(p);

    nest.updateTaskStatus(task.id, "failed", accumulatedText, errStr);

    return { ant, output: accumulatedText, newTasks, pheromones, rateLimited: false };
  } finally {
    try { await session?.dispose(); } catch {}
  }
}
