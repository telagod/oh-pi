import { describe, it, expect, vi } from "vitest";

vi.mock("@mariozechner/pi-coding-agent", () => ({
  AuthStorage: class {},
  createAgentSession: vi.fn(),
  createReadTool: vi.fn(), createBashTool: vi.fn(), createEditTool: vi.fn(),
  createWriteTool: vi.fn(), createGrepTool: vi.fn(), createFindTool: vi.fn(),
  createLsTool: vi.fn(), ModelRegistry: class {}, SessionManager: { inMemory: vi.fn() },
  SettingsManager: { inMemory: vi.fn() }, createExtensionRuntime: vi.fn(),
}));
vi.mock("@mariozechner/pi-ai", () => ({ getModel: vi.fn() }));
vi.mock("@mariozechner/pi-tui", () => ({
  Text: class {},
  Container: class { addChild() {} },
  Spacer: class {},
  matchesKey: vi.fn(),
}));
vi.mock("@sinclair/typebox", () => ({
  Type: {
    Object: vi.fn((x) => x),
    String: vi.fn((x) => x),
    Number: vi.fn((x) => x),
    Optional: vi.fn((x) => x),
  },
}));

import * as core from "./core/index.js";
import * as coreCompat from "./spawner.js";
import * as pi from "./pi/index.js";
import * as piCompat from "./pi-extension.js";

describe("ant-colony architecture compatibility", () => {
  it("core barrel exports real implementations", () => {
    expect(typeof core.spawnAnt).toBe("function");
    expect(typeof core.runColony).toBe("function");
    expect(typeof core.Nest).toBe("function");
    expect(typeof core.buildReport).toBe("function");
  });

  it("root compatibility wrappers forward to core", () => {
    expect(coreCompat.spawnAnt).toBe(core.spawnAnt);
    expect(coreCompat.runDrone).toBe(core.runDrone);
  });

  it("pi barrel exports real integration entrypoints", () => {
    expect(typeof pi.createAntColonyExtension).toBe("function");
    expect(typeof pi.createDefaultPiAdapter).toBe("function");
    expect(typeof pi.registerAntColonyTool).toBe("function");
  });

  it("root pi compatibility wrappers forward to pi modules", () => {
    expect(piCompat.createAntColonyExtension).toBe(pi.createAntColonyExtension);
  });
});
