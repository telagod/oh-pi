/**
 * 蚂蚁 Spawner — 每只蚂蚁是一个独立 pi --mode json 进程
 *
 * 蚂蚁的 system prompt 中注入：
 * - 自己的角色和任务
 * - 巢穴中的信息素上下文
 * - 完成后输出结构化结果的指令
 */

import { spawn as nodeSpawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Ant, AntCaste, AntConfig, Task, Pheromone, DEFAULT_ANT_CONFIGS } from "./types.js";
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

interface AntResult {
  ant: Ant;
  output: string;
  messages: any[];
  newTasks: ParsedSubTask[];
  pheromones: Pheromone[];
  rateLimited: boolean;
}

interface ParsedSubTask {
  title: string;
  description: string;
  files: string[];
  caste: AntCaste;
  priority: 1 | 2 | 3 | 4 | 5;
}

const CASTE_PROMPTS: Record<AntCaste, string> = {
  scout: `You are a Scout Ant. Your job is to explore and gather intelligence, NOT to make changes.

Behavior:
- Quickly scan the codebase to understand structure and locate relevant code
- Identify files, functions, dependencies related to the goal
- Report findings as structured intelligence for Worker Ants

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

## Warnings
Any risks, blockers, or conflicts detected.`,

  worker: `You are a Worker Ant. You execute tasks autonomously and leave traces for the colony.

Behavior:
- Read the pheromone context to understand what scouts and other workers discovered
- Execute your assigned task completely
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

function buildPrompt(task: Task, pheromoneContext: string, castePrompt: string): string {
  let prompt = castePrompt + "\n\n";
  if (pheromoneContext) {
    prompt += `## Colony Pheromone Trail (intelligence from other ants)\n${pheromoneContext}\n\n`;
  }
  prompt += `## Your Assignment\n**Task:** ${task.title}\n**Description:** ${task.description}\n`;
  if (task.files.length > 0) {
    prompt += `**Files scope:** ${task.files.join(", ")}\n`;
  }
  return prompt;
}

function writePromptFile(nestDir: string, antId: string, prompt: string): string {
  const dir = path.join(nestDir, "prompts");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${antId}.md`);
  fs.writeFileSync(file, prompt, { mode: 0o600 });
  return file;
}

/** 从蚂蚁输出中解析子任务声明 */
function parseSubTasks(output: string): ParsedSubTask[] {
  const tasks: ParsedSubTask[] = [];
  const regex = /### TASK:\s*(.+)\n(?:- description:\s*(.+)\n)?(?:- files:\s*(.+)\n)?(?:- caste:\s*(\w+)\n)?(?:- priority:\s*(\d))?/g;
  for (const m of output.matchAll(regex)) {
    tasks.push({
      title: m[1]?.trim() || "Untitled",
      description: m[2]?.trim() || m[1]?.trim() || "",
      files: (m[3]?.trim() || "").split(",").map(f => f.trim()).filter(Boolean),
      caste: (m[4]?.trim() as AntCaste) || "worker",
      priority: (parseInt(m[5] || "3") as 1 | 2 | 3 | 4 | 5) || 3,
    });
  }
  return tasks;
}

/** 从蚂蚁输出中提取信息素 */
function extractPheromones(antId: string, caste: AntCaste, taskId: string, output: string, files: string[]): Pheromone[] {
  const pheromones: Pheromone[] = [];
  const now = Date.now();

  // 提取 ## Discoveries 或 ## Pheromone 段落
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
        content: match[1].trim().slice(0, 2000), // 限制大小
        files,
        strength: 1.0,
        createdAt: now,
      });
    }
  }
  return pheromones;
}

/** 获取蚂蚁输出的最终文本 */
function getFinalOutput(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text") return part.text;
      }
    }
  }
  return "";
}

/**
 * 孵化并运行一只蚂蚁
 */
export async function spawnAnt(
  cwd: string,
  nest: Nest,
  task: Task,
  antConfig: Omit<AntConfig, "systemPrompt">,
  signal?: AbortSignal,
): Promise<AntResult> {
  if (!antConfig.model) throw new Error("No model resolved for ant");
  const antId = makeAntId(antConfig.caste);
  const ant: Ant = {
    id: antId,
    caste: antConfig.caste,
    status: "working",
    taskId: task.id,
    pid: null,
    usage: { input: 0, output: 0, cost: 0, turns: 0 },
    startedAt: Date.now(),
    finishedAt: null,
  };

  nest.updateAnt(ant);
  nest.updateTaskStatus(task.id, "active");

  // 构建 prompt
  const pheromoneCtx = nest.getPheromoneContext(task.files);
  const castePrompt = CASTE_PROMPTS[antConfig.caste];
  const fullPrompt = buildPrompt(task, pheromoneCtx, castePrompt);
  const tmpFile = writePromptFile(nest.dir, antId, fullPrompt);

  const args = [
    "--mode", "json",
    "-p",
    "--no-session",
    "--model", antConfig.model,
    "--tools", antConfig.tools.join(","),
    "--append-system-prompt", tmpFile,
    `Execute this task: ${task.title}\n\n${task.description}`,
  ];

  const messages: any[] = [];
  let stderr = "";

  try {
    const exitCode = await new Promise<number>((resolve) => {
      const proc = nodeSpawn("pi", args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
      ant.pid = proc.pid ?? null;
      nest.updateAnt(ant);

      let buffer = "";

      proc.stdout.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "message_end" && event.message) {
              messages.push(event.message);
              if (event.message.role === "assistant") {
                ant.usage.turns++;
                const u = event.message.usage;
                if (u) {
                  ant.usage.input += u.input || 0;
                  ant.usage.output += u.output || 0;
                  ant.usage.cost += u.cost?.total || 0;
                }
              }
            }
            if (event.type === "tool_result_end" && event.message) {
              messages.push(event.message);
            }
          } catch { /* skip non-json */ }
        }
      });

      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("close", (code) => {
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer);
            if (event.type === "message_end" && event.message) messages.push(event.message);
          } catch { /* skip */ }
        }
        resolve(code ?? 1);
      });
      proc.on("error", () => resolve(1));

      if (signal) {
        const kill = () => {
          try { fs.unlinkSync(tmpFile); } catch { /* already cleaned */ }
          proc.kill("SIGTERM");
          setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 3000);
        };
        if (signal.aborted) kill();
        else signal.addEventListener("abort", kill, { once: true });
      }
    });

    const output = getFinalOutput(messages);
    const success = exitCode === 0;
    const rateLimited = stderr.includes("429") || stderr.includes("rate limit") || stderr.includes("Rate limit")
      || output.includes("429") || output.includes("rate_limit");

    ant.status = success ? "done" : "failed";
    ant.finishedAt = Date.now();
    ant.pid = null;
    nest.updateAnt(ant);

    if (rateLimited) {
      // 429: 不标记任务为 failed，回退为 pending 以便重试
      nest.updateTaskStatus(task.id, "pending");
      ant.status = "failed";
      nest.updateAnt(ant);
      return { ant, output, messages, newTasks: [], pheromones: [], rateLimited: true };
    }

    nest.updateTaskStatus(task.id, success ? "done" : "failed", output, success ? undefined : stderr || output);

    // 解析子任务和信息素
    const newTasks = parseSubTasks(output);
    const pheromones = extractPheromones(antId, antConfig.caste, task.id, output, task.files);
    for (const p of pheromones) nest.dropPheromone(p);

    return { ant, output, messages, newTasks, pheromones, rateLimited: false };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}
