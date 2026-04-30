import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const mocks = vi.hoisted(() => ({
  createAgentSession: vi.fn(),
  getModel: vi.fn(),
  createReadTool: vi.fn((cwd: string) => ({ name: "read", cwd })),
  createBashTool: vi.fn((cwd: string) => ({ name: "bash", cwd })),
  createEditTool: vi.fn((cwd: string) => ({ name: "edit", cwd })),
  createWriteTool: vi.fn((cwd: string) => ({ name: "write", cwd })),
  createGrepTool: vi.fn((cwd: string) => ({ name: "grep", cwd })),
  createFindTool: vi.fn((cwd: string) => ({ name: "find", cwd })),
  createLsTool: vi.fn((cwd: string) => ({ name: "ls", cwd })),
  execSync: vi.fn(),
}));

vi.mock("@mariozechner/pi-coding-agent", () => ({
  AuthStorage: class {},
  ModelRegistry: class {
    constructor(public authStorage?: unknown) {}
    find(_provider: string, _model: string) { return null; }
  },
  createAgentSession: mocks.createAgentSession,
  createReadTool: mocks.createReadTool,
  createBashTool: mocks.createBashTool,
  createEditTool: mocks.createEditTool,
  createWriteTool: mocks.createWriteTool,
  createGrepTool: mocks.createGrepTool,
  createFindTool: mocks.createFindTool,
  createLsTool: mocks.createLsTool,
  SessionManager: { inMemory: vi.fn(() => ({ kind: "session-manager" })) },
  SettingsManager: { inMemory: vi.fn((settings) => ({ kind: "settings-manager", settings })) },
  createExtensionRuntime: vi.fn(() => ({ kind: "extension-runtime" })),
}));

vi.mock("@mariozechner/pi-ai", () => ({
  getModel: mocks.getModel,
}));

vi.mock("node:child_process", () => ({
  execSync: mocks.execSync,
}));

import { runSyncColony } from "./pi/runtime.js";

describe("Pi runtime integration smoke", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ant-runtime-smoke-"));
    vi.clearAllMocks();
    mocks.getModel.mockImplementation((provider: string, id: string) => ({ provider, id }));
    mocks.execSync.mockReturnValue("");
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("runs the sync Pi host path through registry resolution and SDK-backed sessions", async () => {
    const hostedSessions: Array<{ prompt: ReturnType<typeof vi.fn>; abort: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; messages: any[] }> = [];
    const modelRegistry = {
      find: vi.fn((provider: string, id: string) => (
        provider === "openai" && id === "gpt-smoke"
          ? { provider, id, source: "host-registry" }
          : null
      )),
    };

    mocks.execSync.mockImplementation((cmd: string, opts?: { cwd?: string }) => {
      if (cmd.includes("writeFileSync('host-smoke.txt','ok')")) {
        fs.writeFileSync(path.join(opts?.cwd ?? tmpDir, "host-smoke.txt"), "ok");
      }
      return "";
    });

    mocks.createAgentSession.mockImplementation(async ({ model }: { model: any }) => {
      const sessionIndex = hostedSessions.length;
      let listener: ((event: any) => void) | undefined;
      const session = {
        subscribe: vi.fn((cb: (event: any) => void) => { listener = cb; }),
        prompt: vi.fn(async () => {
          const isScout = sessionIndex === 0;
          const output = isScout
            ? [
                "## Recommended Tasks",
                "### TASK: Touch host smoke marker",
                "- description: node -e \"require('node:fs').writeFileSync('host-smoke.txt','ok')\"",
                "- files: host-smoke.txt",
                "- caste: drone",
                "- priority: 1",
                "",
                "## Warnings",
                "None",
              ].join("\n")
            : "## Completed\nHost runtime smoke completed.\n\n## Files Changed\n- host-smoke.txt — created by smoke test";
          listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: output } });
          listener?.({ type: "turn_end" });
          listener?.({ type: "message_end", message: { role: "assistant", usage: { input: 2, output: 3, cost: { total: 0.001 } } } });
        }),
        abort: vi.fn(async () => {}),
        dispose: vi.fn(),
        messages: [{ role: "assistant", content: [{ type: "text", text: "fallback" }] }],
      };
      hostedSessions.push(session);
      expect(model).toEqual({ provider: "openai", id: "gpt-smoke", source: "host-registry" });
      return { session };
    });

    const result = await runSyncColony({
      goal: "Run host-shaped runtime smoke",
      maxAnts: 1,
      maxCost: 1,
      currentModel: "openai/gpt-smoke",
      modelOverrides: {},
      cwd: tmpDir,
      modelRegistry,
    });

    const text = result.content[0]?.text ?? "";
    expect(result.isError).toBe(false);
    expect(text).toContain("**Status:** ✅ done");
    expect(text).toContain("Touch host smoke marker");
    expect(modelRegistry.find).toHaveBeenCalledWith("openai", "gpt-smoke");
    expect(mocks.getModel).not.toHaveBeenCalledWith("openai", "gpt-smoke");
    expect(mocks.createAgentSession).toHaveBeenCalledTimes(1);
    expect(hostedSessions[0].prompt).toHaveBeenCalled();
    expect(hostedSessions[0].dispose).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(path.join(tmpDir, "host-smoke.txt"), "utf8")).toBe("ok");
    expect(fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf8")).toContain(".ant-colony/");
  });

  it("propagates AbortSignal through the Pi host path into SDK session abort/dispose", async () => {
    const controller = new AbortController();
    let rejectPrompt: ((err: Error) => void) | undefined;
    let sdkSession: { prompt: ReturnType<typeof vi.fn>; abort: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; messages: any[] } | undefined;
    const modelRegistry = {
      find: vi.fn((provider: string, id: string) => ({ provider, id, source: "host-registry" })),
    };

    mocks.createAgentSession.mockImplementation(async () => {
      let listener: ((event: any) => void) | undefined;
      sdkSession = {
        subscribe: vi.fn((cb: (event: any) => void) => { listener = cb; }),
        prompt: vi.fn(() => {
          listener?.({
            type: "message_update",
            assistantMessageEvent: { type: "text_delta", delta: "## Discoveries\n- working before abort" },
          });
          return new Promise<void>((_resolve, reject) => { rejectPrompt = reject; });
        }),
        abort: vi.fn(async () => { rejectPrompt?.(new Error("aborted by host smoke")); }),
        dispose: vi.fn(),
        messages: [],
      };
      return { session: sdkSession };
    });

    const resultPromise = runSyncColony({
      goal: "Abort host-shaped runtime smoke",
      maxAnts: 1,
      maxCost: 1,
      currentModel: "openai/gpt-smoke",
      modelOverrides: {},
      cwd: tmpDir,
      modelRegistry,
    }, controller.signal);

    await vi.waitFor(() => expect(sdkSession?.prompt).toHaveBeenCalled());
    controller.abort();
    const result = await resultPromise;

    const text = result.content[0]?.text ?? "";
    expect(result.isError).toBe(true);
    expect(text).toContain("**Status:** ❌ failed");
    expect(text).toContain("aborted by host smoke");
    expect(sdkSession?.abort).toHaveBeenCalledTimes(1);
    expect(sdkSession?.dispose).toHaveBeenCalledTimes(1);
  });
});
