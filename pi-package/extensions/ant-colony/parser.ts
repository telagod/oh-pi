import type { AntCaste, Pheromone, PheromoneType } from "./types.js";
import { makePheromoneId } from "./spawner.js";

export interface ParsedSubTask {
  title: string;
  description: string;
  files: string[];
  caste: AntCaste;
  priority: 1 | 2 | 3 | 4 | 5;
  context?: string;
}

export function parseSubTasks(output: string): ParsedSubTask[] {
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

export function extractPheromones(antId: string, caste: AntCaste, taskId: string, output: string, files: string[], failed = false): Pheromone[] {
  const pheromones: Pheromone[] = [];
  const now = Date.now();
  const sections = ["Discoveries", "Pheromone", "Files Changed", "Warnings", "Review"];
  for (const section of sections) {
    const regex = new RegExp(`## ${section}\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
    const match = output.match(regex);
    if (match?.[1]?.trim()) {
      const type: PheromoneType =
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
