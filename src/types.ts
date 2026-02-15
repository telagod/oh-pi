export interface ProviderConfig {
  name: string;
  apiKey: string;
  defaultModel?: string;
  baseUrl?: string;
  // Model capabilities (used for custom providers)
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
  multimodal?: boolean;
}

export interface OhPConfig {
  providers: ProviderConfig[];
  theme: string;
  keybindings: string;
  extensions: string[];
  skills: string[];
  prompts: string[];
  agents: string;
  thinking: string;
  locale?: string;
  compactThreshold?: number; // 0-1, fraction of context window to trigger compaction (default 0.75)
}

/** Official model capabilities for known providers */
export interface ModelCapabilities {
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  input: ("text" | "image")[];
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // Anthropic
  "claude-sonnet-4-20250514":  { contextWindow: 200000, maxTokens: 16384, reasoning: true,  input: ["text", "image"] },
  "claude-opus-4-0520":        { contextWindow: 200000, maxTokens: 16384, reasoning: true,  input: ["text", "image"] },
  // OpenAI
  "gpt-4o":                    { contextWindow: 128000, maxTokens: 16384, reasoning: false, input: ["text", "image"] },
  "o3-mini":                   { contextWindow: 128000, maxTokens: 65536, reasoning: true,  input: ["text"] },
  // Google
  "gemini-2.5-pro":            { contextWindow: 1048576, maxTokens: 65536, reasoning: true,  input: ["text", "image"] },
  "gemini-2.5-flash":          { contextWindow: 1048576, maxTokens: 65536, reasoning: true,  input: ["text", "image"] },
  // Groq
  "llama-3.3-70b-versatile":   { contextWindow: 128000, maxTokens: 32768, reasoning: false, input: ["text"] },
  // OpenRouter
  "anthropic/claude-sonnet-4": { contextWindow: 200000, maxTokens: 16384, reasoning: true,  input: ["text", "image"] },
  "openai/gpt-4o":             { contextWindow: 128000, maxTokens: 16384, reasoning: false, input: ["text", "image"] },
  // xAI
  "grok-3":                    { contextWindow: 131072, maxTokens: 16384, reasoning: false, input: ["text", "image"] },
  // Mistral
  "mistral-large-latest":      { contextWindow: 128000, maxTokens: 8192,  reasoning: false, input: ["text"] },
};

export const PROVIDERS: Record<string, { env: string; label: string; models: string[] }> = {
  anthropic:  { env: "ANTHROPIC_API_KEY",  label: "Anthropic (Claude)",     models: ["claude-sonnet-4-20250514", "claude-opus-4-0520"] },
  openai:     { env: "OPENAI_API_KEY",     label: "OpenAI (GPT)",           models: ["gpt-4o", "o3-mini"] },
  google:     { env: "GEMINI_API_KEY",     label: "Google Gemini",          models: ["gemini-2.5-pro", "gemini-2.5-flash"] },
  groq:       { env: "GROQ_API_KEY",       label: "Groq (Free, Fast)",      models: ["llama-3.3-70b-versatile"] },
  openrouter: { env: "OPENROUTER_API_KEY", label: "OpenRouter (Multi)",     models: ["anthropic/claude-sonnet-4", "openai/gpt-4o"] },
  xai:        { env: "XAI_API_KEY",        label: "xAI (Grok)",            models: ["grok-3"] },
  mistral:    { env: "MISTRAL_API_KEY",    label: "Mistral",               models: ["mistral-large-latest"] },
};

export const THEMES = [
  { name: "oh-p-dark",        label: "oh-pi Dark (Cyan+Purple)",   style: "dark" },
  { name: "cyberpunk",        label: "Cyberpunk (Neon)",           style: "dark" },
  { name: "nord",             label: "Nord (Arctic)",              style: "dark" },
  { name: "catppuccin-mocha", label: "Catppuccin Mocha (Pastel)",  style: "dark" },
  { name: "tokyo-night",      label: "Tokyo Night (Blue+Purple)",  style: "dark" },
  { name: "gruvbox-dark",     label: "Gruvbox Dark (Warm)",        style: "dark" },
  { name: "dark",             label: "Pi Default Dark",            style: "dark" },
  { name: "light",            label: "Pi Default Light",           style: "light" },
];

export const EXTENSIONS = [
  { name: "safe-guard",        label: "🛡️  Safe Guard — Dangerous command confirm + path protection", default: true },
  { name: "git-guard",         label: "📦 Git Guard — Auto stash checkpoint + dirty repo warning + notify", default: true },
  { name: "auto-session-name", label: "📝 Auto Session Name — Name sessions from first message", default: true },
  { name: "custom-footer",     label: "📊 Custom Footer — Enhanced status bar with tokens, cost, time, git, cwd", default: true },
  { name: "compact-header",    label: "⚡ Compact Header — Dense startup info replacing verbose output", default: true },
  { name: "ant-colony",        label: "🐜 Ant Colony — Autonomous multi-agent swarm with adaptive concurrency", default: false },
];

export const KEYBINDING_SCHEMES: Record<string, object> = {
  default: {},
  vim: {
    cursorUp: ["up", "alt+k"], cursorDown: ["down", "alt+j"],
    cursorLeft: ["left", "alt+h"], cursorRight: ["right", "alt+l"],
    cursorWordLeft: ["alt+left", "alt+b"], cursorWordRight: ["alt+right", "alt+w"],
  },
  emacs: {
    cursorUp: ["up", "ctrl+p"], cursorDown: ["down", "ctrl+n"],
    cursorLeft: ["left", "ctrl+b"], cursorRight: ["right", "ctrl+f"],
    cursorWordLeft: ["alt+left", "alt+b"], cursorWordRight: ["alt+right", "alt+f"],
    deleteCharForward: ["delete", "ctrl+d"], deleteCharBackward: ["backspace", "ctrl+h"],
    cursorLineStart: ["home", "ctrl+a"], cursorLineEnd: ["end", "ctrl+e"],
    newLine: ["shift+enter", "ctrl+j"],
  },
};
