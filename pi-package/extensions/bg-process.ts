/**
 * oh-pi Background Process Extension
 *
 * 任何 bash 命令超时未完成时，自动送到后台执行。
 * 进程完成后自动通过 sendMessage 通知 LLM，无需轮询。
 * 提供 bg_status 工具让 LLM 查看/停止后台进程。
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { spawn, execSync } from "node:child_process";
import { writeFileSync, readFileSync, appendFileSync, existsSync } from "node:fs";

/** 超时阈值（毫秒），超过此时间自动后台化 */
const BG_TIMEOUT_MS = 10_000;

interface BgProcess {
  pid: number;
  command: string;
  logFile: string;
  startedAt: number;
  finished: boolean;
  exitCode: number | null;
}

export default function (pi: ExtensionAPI) {
  const bgProcesses = new Map<number, BgProcess>();

  // 覆盖内置 bash 工具
  pi.registerTool({
    name: "bash",
    label: "Bash",
    description: `Execute a bash command. Output is truncated to 2000 lines or 50KB. If a command runs longer than ${BG_TIMEOUT_MS / 1000}s, it is automatically backgrounded and you get the PID + log file path. Use the bg_status tool to check on backgrounded processes.`,
    parameters: Type.Object({
      command: Type.String({ description: "Bash command to execute" }),
      timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (optional)" })),
    }),
    async execute(toolCallId, params, signal) {
      const { command } = params;
      const userTimeout = params.timeout ? params.timeout * 1000 : undefined;
      const effectiveTimeout = userTimeout ?? BG_TIMEOUT_MS;

      return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let settled = false;
        let backgrounded = false;

        const child = spawn("bash", ["-c", command], {
          cwd: process.cwd(),
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout?.on("data", (d: Buffer) => {
          const chunk = d.toString();
          stdout += chunk;
          // 后台化后追加写入日志
          if (backgrounded) {
            try { appendFileSync(bgProcesses.get(child.pid!)?.logFile ?? "", chunk); } catch {}
          }
        });
        child.stderr?.on("data", (d: Buffer) => {
          const chunk = d.toString();
          stderr += chunk;
          if (backgrounded) {
            try { appendFileSync(bgProcesses.get(child.pid!)?.logFile ?? "", chunk); } catch {}
          }
        });

        // 超时处理：保持管道，标记为后台
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          backgrounded = true;

          child.unref();

          const logFile = `/tmp/oh-pi-bg-${Date.now()}.log`;
          const pid = child.pid!;

          // 把已有输出写入日志
          writeFileSync(logFile, stdout + stderr);

          const proc: BgProcess = { pid, command, logFile, startedAt: Date.now(), finished: false, exitCode: null };
          bgProcesses.set(pid, proc);

          // 监听完成事件，自动通知 LLM
          child.on("close", (code) => {
            proc.finished = true;
            proc.exitCode = code;
            const tail = (stdout + stderr).slice(-3000);
            const truncated = (stdout + stderr).length > 3000 ? "[...truncated]\n" + tail : tail;
            // 最终输出写入日志
            try { writeFileSync(logFile, stdout + stderr); } catch {}

            pi.sendMessage({
              content: `[BG_PROCESS_DONE] PID ${pid} finished (exit ${code ?? "?"})\nCommand: ${command}\n\nOutput (last 3000 chars):\n${truncated}`,
              display: true,
              triggerTurn: true,
              deliverAs: "followUp",
            });
          });

          const preview = (stdout + stderr).slice(0, 500);
          const text = `Command still running after ${effectiveTimeout / 1000}s, moved to background.\nPID: ${pid}\nLog: ${logFile}\nStop: kill ${pid}\n\nOutput so far:\n${preview}\n\n⏳ You will be notified automatically when it finishes. No need to poll.`;

          resolve({
            content: [{ type: "text", text }],
            details: {},
          });
        }, effectiveTimeout);

        // 正常结束（超时前）
        child.on("close", (code) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);

          const output = (stdout + stderr).trim();
          const exitInfo = code !== 0 ? `\n[Exit code: ${code}]` : "";

          resolve({
            content: [{ type: "text", text: output + exitInfo }],
            details: {},
          });
        });

        child.on("error", (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);

          resolve({
            content: [{ type: "text", text: `Error: ${err.message}` }],
            details: {},
            isError: true,
          });
        });

        // 处理 abort signal
        if (signal) {
          signal.addEventListener("abort", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { child.kill(); } catch {}
            resolve({
              content: [{ type: "text", text: "Command cancelled." }],
              details: {},
            });
          }, { once: true });
        }
      });
    },
  });

  // bg_status 工具：查看/管理后台进程
  pi.registerTool({
    name: "bg_status",
    label: "Background Process Status",
    description: "Check status, view output, or stop background processes that were auto-backgrounded.",
    parameters: Type.Object({
      action: StringEnum(["list", "log", "stop"] as const, { description: "list=show all, log=view output, stop=kill process" }),
      pid: Type.Optional(Type.Number({ description: "PID of the process (required for log/stop)" })),
    }),
    async execute(toolCallId, params) {
      const { action, pid } = params;

      if (action === "list") {
        if (bgProcesses.size === 0) {
          return { content: [{ type: "text", text: "No background processes." }], details: {} };
        }
        const lines = [...bgProcesses.values()].map((p) => {
          const status = p.finished ? `⚪ stopped (exit ${p.exitCode ?? "?"})` : (isAlive(p.pid) ? "🟢 running" : "⚪ stopped");
          return `PID: ${p.pid} | ${status} | Log: ${p.logFile}\n  Cmd: ${p.command}`;
        });
        return { content: [{ type: "text", text: lines.join("\n\n") }], details: {} };
      }

      if (!pid) {
        return { content: [{ type: "text", text: "Error: pid is required for log/stop" }], details: {}, isError: true };
      }

      const proc = bgProcesses.get(pid);

      if (action === "log") {
        const logFile = proc?.logFile;
        if (logFile && existsSync(logFile)) {
          try {
            const content = readFileSync(logFile, "utf-8");
            const tail = content.slice(-5000);
            const truncated = content.length > 5000 ? `[...truncated, showing last 5000 chars]\n${tail}` : tail;
            return { content: [{ type: "text", text: truncated || "(empty)" }], details: {} };
          } catch (e: any) {
            return { content: [{ type: "text", text: `Error reading log: ${e.message}` }], details: {}, isError: true };
          }
        }
        return { content: [{ type: "text", text: "No log available for this PID." }], details: {} };
      }

      if (action === "stop") {
        try {
          process.kill(pid, "SIGTERM");
          bgProcesses.delete(pid);
          return { content: [{ type: "text", text: `Process ${pid} terminated.` }], details: {} };
        } catch {
          bgProcesses.delete(pid);
          return { content: [{ type: "text", text: `Process ${pid} not found (already stopped?).` }], details: {} };
        }
      }

      return { content: [{ type: "text", text: `Unknown action: ${action}` }], details: {}, isError: true };
    },
  });

  // 清理：退出时杀掉所有后台进程
  pi.on("session_shutdown", async () => {
    for (const [pid, proc] of bgProcesses) {
      if (!proc.finished) {
        try { process.kill(pid, "SIGTERM"); } catch {}
      }
    }
    bgProcesses.clear();
  });
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
