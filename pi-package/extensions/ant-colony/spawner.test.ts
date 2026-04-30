import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

vi.mock("@mariozechner/pi-coding-agent", () => ({
  AuthStorage: class {},
  createAgentSession: vi.fn(),
  createReadTool: vi.fn(), createBashTool: vi.fn(), createEditTool: vi.fn(),
  createWriteTool: vi.fn(), createGrepTool: vi.fn(), createFindTool: vi.fn(),
  createLsTool: vi.fn(), ModelRegistry: class {}, SessionManager: { inMemory: vi.fn() },
  SettingsManager: { inMemory: vi.fn() }, createExtensionRuntime: vi.fn(),
}));
vi.mock("@mariozechner/pi-ai", () => ({ getModel: vi.fn() }));

import { makeAntId, makePheromoneId, makeTaskId } from "./core/ids.js";
import { Nest } from "./core/nest.js";
import { spawnAnt } from "./core/spawner.js";
import type { AntRuntimeAdapter, AntRuntimeSession } from "./core/runtime.js";
import type { ColonyState, Task } from "./core/types.js";

const mkState = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  id: "test-colony",
  goal: "test",
  status: "working",
  tasks: [],
  ants: [],
  pheromones: [],
  concurrency: { current: 1, min: 1, max: 2, optimal: 1, history: [] },
  metrics: { tasksTotal: 1, tasksDone: 0, tasksFailed: 0, antsSpawned: 0, totalCost: 0, totalTokens: 0, startTime: Date.now(), throughputHistory: [] },
  maxCost: null,
  modelOverrides: {},
  createdAt: Date.now(),
  finishedAt: null,
  ...overrides,
});

const mkTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t-cancel",
  parentId: null,
  title: "Cancelable task",
  description: "Do cancellable work",
  caste: "worker",
  status: "pending",
  priority: 3,
  files: [],
  claimedBy: null,
  result: null,
  error: null,
  spawnedTasks: [],
  createdAt: Date.now(),
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spawner-test-"));
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe("makeAntId", () => {
  it("includes caste name", () => {
    expect(makeAntId("scout")).toContain("scout");
    expect(makeAntId("worker")).toContain("worker");
  });

  it("returns unique ids", () => {
    expect(makeAntId("worker")).not.toBe(makeAntId("worker"));
  });
});

describe("makePheromoneId", () => {
  it("starts with p-", () => {
    expect(makePheromoneId()).toMatch(/^p-/);
  });

  it("returns unique ids", () => {
    expect(makePheromoneId()).not.toBe(makePheromoneId());
  });
});

describe("makeTaskId", () => {
  it("starts with t-", () => {
    expect(makeTaskId()).toMatch(/^t-/);
  });

  it("returns unique ids", () => {
    expect(makeTaskId()).not.toBe(makeTaskId());
  });
});

describe("spawnAnt cancellation semantics", () => {
  it("aborts the runtime session when AbortSignal fires and disposes the session", async () => {
    const task = mkTask();
    const nest = new Nest(tmpDir, "test-colony");
    nest.init(mkState({ tasks: [task] }));

    let rejectPrompt: ((err: Error) => void) | undefined;
    const session: AntRuntimeSession = {
      subscribe: vi.fn(),
      prompt: vi.fn(() => new Promise<void>((_resolve, reject) => { rejectPrompt = reject; })),
      abort: vi.fn(async () => { rejectPrompt?.(new Error("aborted")); }),
      dispose: vi.fn(async () => {}),
      getMessages: vi.fn(() => []),
    };
    const adapter: AntRuntimeAdapter = {
      createSession: vi.fn(async () => session),
    };
    const controller = new AbortController();

    const resultPromise = spawnAnt(
      tmpDir,
      nest,
      task,
      { caste: "worker", model: "test-model", tools: ["read"], maxTurns: 1 },
      controller.signal,
      undefined,
      adapter,
    );

    await vi.waitFor(() => expect(session.prompt).toHaveBeenCalled());
    controller.abort();
    const result = await resultPromise;

    expect(session.abort).toHaveBeenCalledTimes(1);
    expect(session.dispose).toHaveBeenCalledTimes(1);
    expect(result.ant.status).toBe("failed");
    expect(nest.getTask(task.id)?.status).toBe("failed");
    expect(nest.getTask(task.id)?.error).toContain("aborted");
  });
});
