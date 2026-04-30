import {
  AuthStorage,
  createAgentSession,
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createGrepTool,
  createFindTool,
  createLsTool,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSessionEvent,
  type ResourceLoader,
  createExtensionRuntime,
} from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import type {
  AntRuntimeAdapter,
  AntRuntimeEvent,
  AntRuntimeSession,
  AntRuntimeToolName,
  CreateRuntimeSessionOptions,
} from "../core/runtime.js";

export type PiSession = AntRuntimeSession;
export type CreatePiSessionOptions = CreateRuntimeSessionOptions;
export type PiAdapter = AntRuntimeAdapter;

export interface PiAdapterDeps {
  authStorage?: AuthStorage;
  modelRegistry?: ModelRegistry;
}

function resolveModel(modelStr: string, modelRegistry: ModelRegistry) {
  const slashIdx = modelStr.indexOf("/");
  if (slashIdx > 0) {
    const provider = modelStr.slice(0, slashIdx);
    const id = modelStr.slice(slashIdx + 1);
    return modelRegistry.find(provider, id) || getModel(provider, id);
  }
  for (const provider of ["anthropic", "openai", "google"]) {
    const m = modelRegistry.find(provider, modelStr) || getModel(provider, modelStr);
    if (m) return m;
  }
  return null;
}

function makeMinimalResourceLoader(systemPrompt: string): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getAppendSystemPrompt: () => [],
    getPathMetadata: () => new Map(),
    extendResources: () => {},
    reload: async () => {},
  };
}

function createTools(cwd: string, toolNames: AntRuntimeToolName[]) {
  const toolMap: Record<string, (cwd: string) => any> = {
    read: createReadTool,
    bash: createBashTool,
    edit: createEditTool,
    write: createWriteTool,
    grep: createGrepTool,
    find: createFindTool,
    ls: createLsTool,
  };
  return toolNames.map(name => toolMap[name]?.(cwd)).filter(Boolean);
}

function toRuntimeEvent(event: AgentSessionEvent): AntRuntimeEvent | null {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    return { type: "text_delta", delta: event.assistantMessageEvent.delta };
  }

  if (event.type === "turn_end") {
    return { type: "turn_end" };
  }

  if (event.type === "message_end" && event.message?.role === "assistant") {
    const usage = (event.message as any).usage;
    return {
      type: "assistant_message_end",
      usage: usage ? {
        input: usage.input || 0,
        output: usage.output || 0,
        costTotal: usage.cost?.total || 0,
      } : undefined,
    };
  }

  return null;
}

class DefaultPiAdapter implements AntRuntimeAdapter {
  private readonly authStorage: AuthStorage;
  private readonly modelRegistry: ModelRegistry;

  constructor(deps?: PiAdapterDeps) {
    this.authStorage = deps?.authStorage ?? new AuthStorage();
    this.modelRegistry = deps?.modelRegistry ?? new ModelRegistry(this.authStorage);
  }

  async createSession(options: CreateRuntimeSessionOptions): Promise<AntRuntimeSession> {
    const model = resolveModel(options.model, this.modelRegistry);
    if (!model) throw new Error(`Model not found: ${options.model}`);

    const resourceLoader = makeMinimalResourceLoader(options.systemPrompt);
    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 1 },
    });

    const created = await createAgentSession({
      cwd: options.cwd,
      model,
      thinkingLevel: "off",
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      resourceLoader,
      tools: createTools(options.cwd, options.toolNames),
      sessionManager: SessionManager.inMemory(),
      settingsManager,
    });

    const session = created.session;
    return {
      subscribe(listener) {
        session.subscribe((event: AgentSessionEvent) => {
          const runtimeEvent = toRuntimeEvent(event);
          if (runtimeEvent) listener(runtimeEvent);
        });
      },
      async prompt(prompt: string) {
        await session.prompt(prompt);
      },
      async abort() {
        await session.abort();
      },
      async dispose() {
        session.dispose();
      },
      getMessages() {
        return session.messages;
      },
    };
  }
}

export function createDefaultPiAdapter(deps?: PiAdapterDeps): PiAdapter {
  return new DefaultPiAdapter(deps);
}
