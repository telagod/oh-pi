import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OhPConfig } from "../types.js";
import { writeAgents } from "./writers.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "oh-pi-writers-"));
  tempDirs.push(dir);
  return dir;
}

function makeConfig(overrides: Partial<OhPConfig>): OhPConfig {
  return {
    providers: [],
    theme: "dark",
    keybindings: "default",
    extensions: [],
    prompts: [],
    agents: "general-developer",
    thinking: "medium",
    ...overrides,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("writeAgents", () => {
  it("appends ant-colony auto-trigger guidance for non-colony operator agents", () => {
    const dir = makeTempDir();
    writeAgents(dir, makeConfig({
      agents: "general-developer",
      extensions: ["ant-colony"],
    }));

    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).toContain("## Ant Colony Auto-Trigger");
    expect(content).toContain("automatically use it when the task is complex");
    expect(content).toContain("COLONY_SIGNAL");
  });

  it("does not append guidance when ant-colony extension is disabled", () => {
    const dir = makeTempDir();
    writeAgents(dir, makeConfig({
      agents: "general-developer",
      extensions: [],
    }));

    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).not.toContain("## Ant Colony Auto-Trigger");
  });

  it("does not append duplicate guidance for colony-operator template", () => {
    const dir = makeTempDir();
    writeAgents(dir, makeConfig({
      agents: "colony-operator",
      extensions: ["ant-colony"],
    }));

    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).not.toContain("## Ant Colony Auto-Trigger");
    expect(content).toContain("You command an autonomous ant colony");
  });
});
