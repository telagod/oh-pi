/** 模型提供商配置 */
export interface ProviderConfig {
  /** 提供商名称 */
  name: string;
  /** API 密钥 */
  apiKey: string;
  /** 默认模型 */
  defaultModel?: string;
  /** 自定义 API 地址 */
  baseUrl?: string;
  /** 上下文窗口大小（自定义提供商用） */
  contextWindow?: number;
  /** 最大输出 token 数（自定义提供商用） */
  maxTokens?: number;
  /** 是否支持推理 */
  reasoning?: boolean;
  /** 是否支持多模态 */
  multimodal?: boolean;
}

/** oh-pi 全局配置 */
export interface OhPConfig {
  /** 已配置的提供商列表 */
  providers: ProviderConfig[];
  /** 主题名称 */
  theme: string;
  /** 快捷键方案 */
  keybindings: string;
  /** 启用的扩展列表 */
  extensions: string[];
  /** 提示词模板列表 */
  prompts: string[];
  /** Agent 配置路径 */
  agents: string;
  /** 思维模式 */
  thinking: string;
  /** 语言区域 */
  locale?: string;
  /** 上下文压缩阈值，0-1，占上下文窗口的比例（默认 0.75） */
  compactThreshold?: number;
}

/** 已知模型的官方能力参数 */
export interface ModelCapabilities {
  /** 上下文窗口大小 */
  contextWindow: number;
  /** 最大输出 token 数 */
  maxTokens: number;
  /** 是否支持推理 */
  reasoning: boolean;
  /** 支持的输入类型 */
  input: ("text" | "image")[];
}

/** 各模型能力参数映射表 */
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

/** 支持的提供商注册表（名称、环境变量、可用模型） */
export const PROVIDERS: Record<string, { env: string; label: string; models: string[] }> = {
  anthropic:  { env: "ANTHROPIC_API_KEY",  label: "Anthropic (Claude)",     models: ["claude-sonnet-4-20250514", "claude-sonnet-4-5-20250929", "claude-opus-4-20250514", "claude-haiku-4-5-20251001"] },
  openai:     { env: "OPENAI_API_KEY",     label: "OpenAI (GPT)",           models: ["gpt-4o", "o3-mini"] },
  google:     { env: "GEMINI_API_KEY",     label: "Google Gemini",          models: ["gemini-2.5-pro", "gemini-2.5-flash"] },
  groq:       { env: "GROQ_API_KEY",       label: "Groq (Free, Fast)",      models: ["llama-3.3-70b-versatile"] },
  openrouter: { env: "OPENROUTER_API_KEY", label: "OpenRouter (Multi)",     models: ["anthropic/claude-sonnet-4", "openai/gpt-4o"] },
  xai:        { env: "XAI_API_KEY",        label: "xAI (Grok)",            models: ["grok-3"] },
  mistral:    { env: "MISTRAL_API_KEY",    label: "Mistral",               models: ["mistral-large-latest"] },
};

/** 可用主题列表 */
export const THEMES = [
  { name: "dark",             label: "Pi Default Dark",            style: "dark" },
  { name: "oh-p-dark",        label: "oh-pi Dark (Cyan+Purple)",   style: "dark" },
  { name: "cyberpunk",        label: "Cyberpunk (Neon)",           style: "dark" },
  { name: "nord",             label: "Nord (Arctic)",              style: "dark" },
  { name: "catppuccin-mocha", label: "Catppuccin Mocha (Pastel)",  style: "dark" },
  { name: "tokyo-night",      label: "Tokyo Night (Blue+Purple)",  style: "dark" },
  { name: "gruvbox-dark",     label: "Gruvbox Dark (Warm)",        style: "dark" },
  { name: "light",            label: "Pi Default Light",           style: "light" },
];

/** 可用扩展列表 */
export const EXTENSIONS = [
  { name: "safe-guard",        label: "🛡️  Safe Guard — Dangerous command confirm + path protection", default: true },
  { name: "git-guard",         label: "📦 Git Guard — Auto stash checkpoint + dirty repo warning + notify", default: true },
  { name: "auto-session-name", label: "📝 Auto Session Name — Name sessions from first message", default: true },
  { name: "custom-footer",     label: "📊 Custom Footer — Enhanced status bar with tokens, cost, time, git, cwd", default: true },
  { name: "compact-header",    label: "⚡ Compact Header — Dense startup info replacing verbose output", default: true },
  { name: "ant-colony",        label: "🐜 Ant Colony — Autonomous multi-agent swarm with adaptive concurrency", default: false },
  { name: "auto-update",       label: "🔄 Auto Update — Check for oh-pi updates on startup and notify", default: true },
];

/** 快捷键绑定方案（default / vim / emacs） */
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
