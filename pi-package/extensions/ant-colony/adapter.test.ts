import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAgentSession: vi.fn(),
  getModel: vi.fn(),
  modelRegistryFind: vi.fn(),
  createReadTool: vi.fn((cwd: string) => ({ name: "read", cwd })),
  createBashTool: vi.fn((cwd: string) => ({ name: "bash", cwd })),
  createEditTool: vi.fn((cwd: string) => ({ name: "edit", cwd })),
  createWriteTool: vi.fn((cwd: string) => ({ name: "write", cwd })),
  createGrepTool: vi.fn((cwd: string) => ({ name: "grep", cwd })),
  createFindTool: vi.fn((cwd: string) => ({ name: "find", cwd })),
  createLsTool: vi.fn((cwd: string) => ({ name: "ls", cwd })),
}));

vi.mock("@mariozechner/pi-coding-agent", () => ({
  AuthStorage: class {},
  ModelRegistry: class {
    find(provider: string, model: string) { return mocks.modelRegistryFind(provider, model); }
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

import { createDefaultPiAdapter } from "./pi/adapter.js";
import type { AntRuntimeEvent } from "./core/runtime.js";

describe("createDefaultPiAdapter", () => {
  let sdkListener: ((event: any) => void) | undefined;
  const sdkSession = {
    subscribe: vi.fn((listener: (event: any) => void) => { sdkListener = listener; }),
    prompt: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
    dispose: vi.fn(),
    messages: [{ role: "assistant", content: [{ type: "text", text: "final" }] }],
  };

  beforeEach(() => {
    sdkListener = undefined;
    vi.clearAllMocks();
    mocks.modelRegistryFind.mockReturnValue(null);
    mocks.getModel.mockReturnValue({ provider: "anthropic", id: "claude-test" });
    mocks.createAgentSession.mockResolvedValue({ session: sdkSession });
  });

  it("creates Pi tools inside the adapter from runtime tool names", async () => {
    const adapter = createDefaultPiAdapter();

    await adapter.createSession({
      cwd: "/tmp/project",
      model: "claude-test",
      systemPrompt: "system",
      toolNames: ["read", "bash", "unknown"],
    });

    expect(mocks.createReadTool).toHaveBeenCalledWith("/tmp/project");
    expect(mocks.createBashTool).toHaveBeenCalledWith("/tmp/project");
    expect(mocks.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({
      cwd: "/tmp/project",
      tools: [
        { name: "read", cwd: "/tmp/project" },
        { name: "bash", cwd: "/tmp/project" },
      ],
    }));
  });

  it("translates Pi SDK session events into runtime events", async () => {
    const adapter = createDefaultPiAdapter();
    const session = await adapter.createSession({
      cwd: "/tmp/project",
      model: "claude-test",
      systemPrompt: "system",
      toolNames: [],
    });
    const events: AntRuntimeEvent[] = [];

    session.subscribe(event => events.push(event));

    sdkListener?.({
      type: "message_update",
      assistantMessageEvent: { type: "text_delta", delta: "hello" },
    });
    sdkListener?.({ type: "turn_end" });
    sdkListener?.({
      type: "message_end",
      message: {
        role: "assistant",
        usage: { input: 3, output: 5, cost: { total: 0.012 } },
      },
    });
    sdkListener?.({ type: "message_end", message: { role: "user" } });

    expect(events).toEqual([
      { type: "text_delta", delta: "hello" },
      { type: "turn_end" },
      { type: "assistant_message_end", usage: { input: 3, output: 5, costTotal: 0.012 } },
    ]);
  });

  it("forwards prompt, abort, dispose, and messages through the runtime session", async () => {
    const adapter = createDefaultPiAdapter();
    const session = await adapter.createSession({
      cwd: "/tmp/project",
      model: "claude-test",
      systemPrompt: "system",
      toolNames: [],
    });

    await session.prompt("do it");
    await session.abort();
    await session.dispose();

    expect(sdkSession.prompt).toHaveBeenCalledWith("do it");
    expect(sdkSession.abort).toHaveBeenCalled();
    expect(sdkSession.dispose).toHaveBeenCalled();
    expect(session.getMessages()).toEqual(sdkSession.messages);
  });

  it("resolves explicit provider/model through ModelRegistry before getModel fallback", async () => {
    const registryModel = { provider: "openai", id: "gpt-test", source: "registry" };
    mocks.modelRegistryFind.mockReturnValueOnce(registryModel);
    const adapter = createDefaultPiAdapter();

    await adapter.createSession({
      cwd: "/tmp/project",
      model: "openai/gpt-test",
      systemPrompt: "system",
      toolNames: [],
    });

    expect(mocks.modelRegistryFind).toHaveBeenCalledWith("openai", "gpt-test");
    expect(mocks.getModel).not.toHaveBeenCalledWith("openai", "gpt-test");
    expect(mocks.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({
      model: registryModel,
    }));
  });

  it("falls back across known providers for bare model names", async () => {
    const googleModel = { provider: "google", id: "gemini-test" };
    mocks.getModel.mockImplementation((provider: string, id: string) => (
      provider === "google" && id === "gemini-test" ? googleModel : null
    ));
    const adapter = createDefaultPiAdapter();

    await adapter.createSession({
      cwd: "/tmp/project",
      model: "gemini-test",
      systemPrompt: "system",
      toolNames: [],
    });

    expect(mocks.modelRegistryFind).toHaveBeenCalledWith("anthropic", "gemini-test");
    expect(mocks.modelRegistryFind).toHaveBeenCalledWith("openai", "gemini-test");
    expect(mocks.modelRegistryFind).toHaveBeenCalledWith("google", "gemini-test");
    expect(mocks.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({
      model: googleModel,
    }));
  });

  it("throws when neither ModelRegistry nor getModel can resolve a model", async () => {
    mocks.getModel.mockReturnValue(null);
    const adapter = createDefaultPiAdapter();

    await expect(adapter.createSession({
      cwd: "/tmp/project",
      model: "missing-model",
      systemPrompt: "system",
      toolNames: [],
    })).rejects.toThrow("Model not found: missing-model");
  });
});
