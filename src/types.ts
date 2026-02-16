/** 支持的语言区域 */
export type Locale = "en" | "zh" | "fr";

/** 动态发现的模型信息 */
export interface DiscoveredModel {
  id: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  contextWindow: number;
  maxTokens: number;
}

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
  /** 检测到的 API 类型 */
  api?: string;
  /** 动态发现的所有模型 */
  discoveredModels?: DiscoveredModel[];
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
