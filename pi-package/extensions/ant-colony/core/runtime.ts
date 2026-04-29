import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";

export interface AntRuntimeSession {
  subscribe(listener: (event: AgentSessionEvent) => void): void;
  prompt(prompt: string): Promise<void>;
  abort(): Promise<void>;
  dispose(): Promise<void>;
  getMessages(): any[];
}

export interface CreateRuntimeSessionOptions {
  cwd: string;
  model: string;
  systemPrompt: string;
  tools: any[];
}

export interface AntRuntimeAdapter {
  createSession(options: CreateRuntimeSessionOptions): Promise<AntRuntimeSession>;
}
