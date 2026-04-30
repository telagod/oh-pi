export type AntRuntimeToolName = "read" | "bash" | "edit" | "write" | "grep" | "find" | "ls" | string;

export interface AntRuntimeUsage {
  input?: number;
  output?: number;
  costTotal?: number;
}

export type AntRuntimeEvent =
  | { type: "text_delta"; delta: string }
  | { type: "turn_end" }
  | { type: "assistant_message_end"; usage?: AntRuntimeUsage };

export interface AntRuntimeMessagePart {
  type?: string;
  text?: string;
}

export interface AntRuntimeMessage {
  role?: string;
  content?: AntRuntimeMessagePart[];
}

export interface AntRuntimeSession {
  subscribe(listener: (event: AntRuntimeEvent) => void): void;
  prompt(prompt: string): Promise<void>;
  abort(): Promise<void>;
  dispose(): Promise<void>;
  getMessages(): AntRuntimeMessage[];
}

export interface CreateRuntimeSessionOptions {
  cwd: string;
  model: string;
  systemPrompt: string;
  toolNames: AntRuntimeToolName[];
}

export interface AntRuntimeAdapter {
  createSession(options: CreateRuntimeSessionOptions): Promise<AntRuntimeSession>;
}
