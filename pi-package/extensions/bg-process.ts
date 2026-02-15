/**
 * oh-pi Background Process Extension
 *
 * 任何 bash 命令超时未完成时，自动送到后台执行。
 * 提供 bg_status 工具让 LLM 查看/停止后台进程。
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { spawn, execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

/** 超时阈值（毫秒），超过此时间自动后台化 */
const BG_TIMEOUT_MS = 10_000;

interface BgProcess {
  pid: number;
  command: string;
  logFile: string;
  startedAt: number;
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

        const child = spawn("bash", ["-c", command], {
          cwd: process.cwd(),
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
        child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

        // 超时处理：分离进程，送到后台
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;

          // 分离子进程，让它继续运行
          child.stdout?.removeAllListeners();
          child.stderr?.removeAllListeners();
          child.removeAllListeners();
          child.unref();

          const logFile = `/tmp/oh-pi-bg-${Date.now()}.log`;
          const pid = child.pid!;

          // 启动一个 tail 进程把后续输出写入日志
          try {
            const tailCmd = `(echo ${JSON.stringify(stdout + stderr)}; tail --pid=${pid} -f /proc/${pid}/fd/1 2>/dev/null) > ${logFile} 2>&1 &`;
            spawn("bash", ["-c", tailCmd], { detached: true, stdio: "ignore" }).unref();
          } catch {
            // fallback: 至少把已有输出写入日志
            writeFileSync(logFile, stdout + stderr);
          }

          bgProcesses.set(pid, { pid, command, logFile, startedAt: Date.now() });

          const preview = (stdout + stderr).slice(0, 500);
          const text = `Command still running after ${effectiveTimeout / 1000}s, moved to background.\nPID: ${pid}\nLog: ${logFile}\nView output: tail -f ${logFile}\nStop: kill ${pid}\n\nOutput so far:\n${preview}`;

          resolve({
            content: [{ type: "text", text }],
            details: {},
          });
        }, effectiveTimeout);

        // 正常结束
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
          const alive = isAlive(p.pid);
          const status = alive ? "🟢 running" : "⚪ stopped";
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
        // fallback: 直接读 /proc
        try {
          const out = execSync(`tail -20 /proc/${pid}/fd/1 2>/dev/null || echo "(cannot read output)"`, { timeout: 3000 }).toString();
          return { content: [{ type: "text", text: out }], details: {} };
        } catch {
          return { content: [{ type: "text", text: "No log available for this PID." }], details: {} };
        }
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
    for (const [pid] of bgProcesses) {
      try { process.kill(pid, "SIGTERM"); } catch {}
    }
    bgProcesses.clear();
  });
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
