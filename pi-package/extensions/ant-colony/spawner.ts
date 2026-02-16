/**
 * 蚂蚁 Spawner — 每只蚂蚁是一个内嵌 AgentSession (SDK)
 *
 * 替代旧的 `pi --mode json` 子进程方案：
 * - 零启动开销（同进程）
 * - 真实时 token 流（session.subscribe）
 * - 共享 auth/model registry
 */

import {
  AuthStorage,
  createAgentSession,
  createCodingTools,
  createReadOnlyTools,
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createGrepTool,
  createFindTool,
  createLsTool,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type ResourceLoader,
  type AgentSessionEvent,
  createExtensionRuntime,
} from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import type { Ant, AntCaste, AntConfig, Task, Pheromone, AntStreamEvent } from "./types.js";
import type { Nest } from "./nest.js";

let antCounter = 0;

export function makeAntId(caste: AntCaste): string {
  return `${caste}-${++antCounter}-${Date.now().toString(36)}`;
}

export function makePheromoneId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function makeTaskId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface AntResult {
  ant: Ant;
  output: string;
  newTasks: ParsedSubTask[];
  pheromones: Pheromone[];
  rateLimited: boolean;
}

export interface ParsedSubTask {
  title: string;
  description: string;
  files: string[];
  caste: AntCaste;
  priority: 1 | 2 | 3 | 4 | 5;
  context?: string;
}

const CASTE_PROMPTS: Record<AntCaste, string> = {
  scout: `You are a Scout Ant. Your job is to explore and gather intelligence, NOT to make changes.

Behavior:
- Quickly scan the codebase to understand structure and locate relevant code
- Identify files, functions, dependencies related to the goal
- IMPORTANT: After EACH tool call, summarize what you found so far. Do NOT wait until the end.
- Report findings as structured intelligence for Worker Ants
- For each recommended task, include the KEY code snippets (with file:line) the worker will need — this saves workers from re-reading files

Output format (MUST follow exactly):
## Discoveries
- What you found, with file:line references

## Recommended Tasks
For each task the colony should do next:
### TASK: <title>
- description: <what to do>
- files: <comma-separated file paths>
- caste: worker
- priority: <1-5, 1=highest>
- context: <relevant code snippets that the worker will need, with file:line references>

Use caste "drone" instead of "worker" for simple tasks that can be done with a single bash command (file copy, find-replace, formatting, running tests). Drone description should be the exact bash command to execute.

## Warnings
Any risks, blockers, or conflicts detected.`,

  worker: `You are a Worker Ant. You execute tasks autonomously and leave traces for the colony.

Behavior:
- Read the pheromone context to understand what scouts and other workers discovered
- Execute your assigned task completely
- After making changes, verify your work (e.g. run the build, check syntax). If verification fails, fix it yourself or declare a fix sub-task
- If you discover sub-tasks needed, declare them (do NOT execute them yourself)
- Minimize file conflicts — only touch files assigned to you

Output format (MUST follow exactly):
## Completed
What was done, with file:line references for all changes.

## Files Changed
- path/to/file.ts — what changed

## Sub-Tasks (if any)
### TASK: <title>
- description: <what to do>
- files: <comma-separated file paths>
- caste: <worker|soldier>
- priority: <1-5>

## Pheromone
Key information other ants should know about your changes.`,

  soldier: `You are a Soldier Ant (Reviewer). You guard colony quality — you do NOT make changes.

Behavior:
- Review the files changed by worker ants
- Check for bugs, security issues, conflicts between workers
- Report issues that need fixing

Output format (MUST follow exactly):
## Review
- file:line — issue description (severity: critical|warning|info)

## Fix Tasks (if critical issues found)
### TASK: <title>
- description: <what to fix>
- files: <comma-separated file paths>
- caste: worker
- priority: 1

## Verdict
PASS or FAIL with summary.`,
};

function buildPrompt(task: Task, pheromoneContext: string, castePrompt: string, maxTurns?: number): string {
  let prompt = castePrompt + "\n\n";
  if (maxTurns) {
    prompt += `## ⚠️ Turn Limit\nYou have a MAXIMUM of ${maxTurns} turns. Plan accordingly — reserve your LAST turn to output the structured result format above. Do NOT waste turns on unnecessary exploration.\n\n`;
  }
  if (pheromoneContext) {
    prompt += `## Colony Pheromone Trail (intelligence from other ants)\n${pheromoneContext}\n\n`;
  }
  prompt += `## Your Assignment\n**Task:** ${task.title}\n**Description:** ${task.description}\n`;
  if (task.files.length > 0) {
    prompt += `**Files scope:** ${task.files.join(", ")}\n`;
  }
  if (task.context) {
    prompt += `\n## Pre-loaded Context (from scout)\n${task.context}\n`;
  }
  if (/[\u4e00-\u9fff]/.test(task.description)) {
    prompt += '\nIMPORTANT: Follow the language requirements specified in the task description. If the task says to write in Chinese, write in Chinese.\n';
  }
  return prompt;
}

/** 从蚂蚁输出中解析子任务声明 */
function parseSubTasks(output: string): ParsedSubTask[] {
  const tasks: ParsedSubTask[] = [];
  const regex = /### TASK:\s*(.+)\n(?:- description:\s*(.+)\n)?(?:- files:\s*(.+)\n)?(?:- caste:\s*(\w+)\n)?(?:- priority:\s*(\d))?/g;
  const taskBlocks = output.split(/(?=### TASK:)/);
  for (const m of output.matchAll(regex)) {
    const block = taskBlocks.find(b => b.includes(`### TASK: ${m[1]?.trim()}`)) || "";
    const ctxMatch = block.match(/- context:\s*([\s\S]*?)(?=### TASK:|## |\n\n|$)/);
    const context = ctxMatch?.[1]?.trim() || undefined;
    tasks.push({
      title: m[1]?.trim() || "Untitled",
      description: m[2]?.trim() || m[1]?.trim() || "",
      files: (m[3]?.trim() || "").split(",").map((f: string) => f.trim()).filter(Boolean),
      caste: (m[4]?.trim() as AntCaste) || "worker",
      priority: (parseInt(m[5] || "3") as 1 | 2 | 3 | 4 | 5) || 3,
      context,
    });
  }
  return tasks;
}

/** 从蚂蚁输出中提取信息素（failed=true 时自动释放 repellent） */
function extractPheromones(antId: string, caste: AntCaste, taskId: string, output: string, files: string[], failed = false): Pheromone[] {
  const pheromones: Pheromone[] = [];
  const now = Date.now();
  const sections = ["Discoveries", "Pheromone", "Files Changed", "Warnings", "Review"];
  for (const section of sections) {
    const regex = new RegExp(`## ${section}\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
    const match = output.match(regex);
    if (match?.[1]?.trim()) {
      const type: import("./types.js").PheromoneType =
        section === "Discoveries" ? "discovery" :
        section === "Warnings" || section === "Review" ? "warning" :
        section === "Files Changed" ? "completion" : "progress";
      pheromones.push({
        id: makePheromoneId(),
        type,
        antId,
        antCaste: caste,
        taskId,
        content: match[1].trim().slice(0, 2000),
        files,
        strength: 1.0,
        createdAt: now,
      });
    }
  }
  if (failed && files.length > 0) {
    pheromones.push({
      id: makePheromoneId(),
      type: "repellent",
      antId,
      antCaste: caste,
      taskId,
      content: `Task failed on files: ${files.join(", ")}`,
      files,
      strength: 1.0,
      createdAt: now,
    });
  }
  return pheromones;
}

/** 根据 tools 列表创建对应的 tool 实例 */
function createToolsForCaste(cwd: string, toolNames: string[]) {
  const toolMap: Record<string, (cwd: string) => any> = {
    read: createReadTool,
    bash: createBashTool,
    edit: createEditTool,
    write: createWriteTool,
    grep: createGrepTool,
    find: createFindTool,
    ls: createLsTool,
  };
  return toolNames.map(name => toolMap[name]?.(cwd)).filter(Boolean);
}

/** 解析 "provider/model-id" 格式的模型字符串 */
function resolveModel(modelStr: string, modelRegistry: ModelRegistry) {
  const slashIdx = modelStr.indexOf("/");
  if (slashIdx > 0) {
    const provider = modelStr.slice(0, slashIdx);
    const id = modelStr.slice(slashIdx + 1);
    return modelRegistry.find(provider, id) || getModel(provider, id);
  }
  // 尝试所有 provider
  for (const provider of ["anthropic", "openai", "google"]) {
    const m = modelRegistry.find(provider, modelStr) || getModel(provider, modelStr);
    if (m) return m;
  }
  return null;
}

/** 最小化 ResourceLoader，蚂蚁不需要 extensions/skills */
function makeMinimalResourceLoader(systemPrompt: string): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getAppendSystemPrompt: () => [],
    getPathMetadata: () => new Map(),
    extendResources: () => {},
    reload: async () => {},
  };
}

/**
 * 运行 Drone — 纯规则执行，零 LLM 成本
 * 任务描述即为要执行的 bash 命令
 */
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
    const cmd = task.description;
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

/**
 * 孵化并运行一只蚂蚁 — SDK 内嵌版
 */
export async function spawnAnt(
  cwd: string,
  nest: Nest,
  task: Task,
  antConfig: Omit<AntConfig, "systemPrompt">,
  signal?: AbortSignal,
  onStream?: (event: AntStreamEvent) => void,
  authStorage?: AuthStorage,
  modelRegistry?: ModelRegistry,
): Promise<AntResult> {
  if (!antConfig.model) throw new Error("No model resolved for ant");
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

  // 构建 system prompt
  const pheromoneCtx = nest.getPheromoneContext(task.files);
  const castePrompt = CASTE_PROMPTS[antConfig.caste];
  const systemPrompt = buildPrompt(task, pheromoneCtx, castePrompt, antConfig.maxTurns);

  // 解析模型
  const auth = authStorage ?? new AuthStorage();
  const registry = modelRegistry ?? new ModelRegistry(auth);
  const model = resolveModel(antConfig.model, registry);
  if (!model) throw new Error(`Model not found: ${antConfig.model}`);

  const tools = createToolsForCaste(cwd, antConfig.tools);
  const resourceLoader = makeMinimalResourceLoader(systemPrompt);

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: true, maxRetries: 1 },
  });

  let accumulatedText = "";
  let rateLimited = false;

  try {
    const { session } = await createAgentSession({
      cwd,
      model,
      thinkingLevel: "off",
      authStorage: auth,
      modelRegistry: registry,
      resourceLoader,
      tools,
      sessionManager: SessionManager.inMemory(),
      settingsManager,
    });

    // 订阅实时事件
    session.subscribe((event: AgentSessionEvent) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        const delta = event.assistantMessageEvent.delta;
        accumulatedText += delta;
        onStream?.({
          antId,
          caste: antConfig.caste,
          taskId: task.id,
          delta,
          totalText: accumulatedText,
        });
      }

      if (event.type === "turn_end") {
        ant.usage.turns++;
        // 实时提取信息素（scout）
        if (antConfig.caste === "scout" && accumulatedText) {
          const livePheromones = extractPheromones(antId, antConfig.caste, task.id, accumulatedText, task.files);
          for (const p of livePheromones) {
            p.id = makePheromoneId();
            nest.dropPheromone(p);
          }
        }
      }

      if (event.type === "message_end" && event.message?.role === "assistant") {
        const u = (event.message as any).usage;
        if (u) {
          ant.usage.input += u.input || 0;
          ant.usage.output += u.output || 0;
          ant.usage.cost += u.cost?.total || 0;
        }
      }
    });

    // 执行任务
    const userPrompt = `Execute this task: ${task.title}\n\n${task.description}`;

    // 处理 abort signal
    if (signal) {
      const onAbort = () => session.abort();
      if (signal.aborted) {
        await session.abort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    await session.prompt(userPrompt);

    // 获取最终输出
    const messages = session.messages;
    let finalOutput = accumulatedText;
    if (!finalOutput) {
      // fallback: 从 messages 中提取
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === "assistant") {
          for (const part of msg.content) {
            if ((part as any).type === "text") {
              finalOutput = (part as any).text;
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

    session.dispose();

    return { ant, output: finalOutput, newTasks, pheromones, rateLimited: false };

  } catch (e: any) {
    const errStr = String(e);
    rateLimited = errStr.includes("429") || errStr.includes("rate limit") || errStr.includes("Rate limit");

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

    // 尝试解析部分产出
    const newTasks = parseSubTasks(accumulatedText);
    const pheromones = extractPheromones(antId, antConfig.caste, task.id, accumulatedText, task.files, true);
    for (const p of pheromones) nest.dropPheromone(p);

    nest.updateTaskStatus(task.id, "failed", accumulatedText, errStr);

    return { ant, output: accumulatedText, newTasks, pheromones, rateLimited: false };
  }
}
