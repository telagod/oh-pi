import * as p from "@clack/prompts";
import chalk from "chalk";
import { t } from "../i18n.js";
import type { ProviderConfig, DiscoveredModel } from "../types.js";
import { PROVIDERS } from "../registry.js";
import type { EnvInfo } from "../utils/detect.js";

/** Provider API base URLs for dynamic model fetching */
const PROVIDER_API_URLS: Record<string, string> = {
  anthropic:  "https://api.anthropic.com",
  openai:     "https://api.openai.com",
  google:     "https://generativelanguage.googleapis.com",
  groq:       "https://api.groq.com",
  openrouter: "https://openrouter.ai",
  xai:        "https://api.x.ai",
  mistral:    "https://api.mistral.ai",
};

/** Block internal/private IPs to prevent SSRF */
function isUnsafeUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname;
    // Allow localhost for local dev servers (Ollama, vLLM, etc.)
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    // Block private IP ranges
    if (/^10\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^0\./.test(host) || host === "0.0.0.0") return true;
    if (host.includes(":") || host.startsWith("[")) return true;
    if (/^169\.254\./.test(host)) return true;
    // Block non-https for remote hosts
    if (u.protocol !== "https:") return true;
    return false;
  } catch { return true; }
}

interface FetchResult {
  models: DiscoveredModel[];
  api?: string;
}

/**
 * 动态获取模型列表，依次尝试 Anthropic、Google、OpenAI 兼容 API 风格。
 * @param provider - 提供商名称
 * @param baseUrl - API 基础地址
 * @param apiKey - API 密钥或环境变量名
 * @returns 发现的模型列表及检测到的 API 类型
 */
async function fetchModels(provider: string, baseUrl: string, apiKey: string): Promise<FetchResult> {
  const base = baseUrl.replace(/\/+$/, "");
  const resolvedKey = process.env[apiKey] ?? apiKey;

  // Try Anthropic-style first (for known anthropic or any provider)
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: { "x-api-key": resolvedKey, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = await res.json() as { data?: any[] };
      const data = json.data ?? [];
      if (data.length > 0 && data[0].owned_by === "anthropic") {
        return {
          api: "anthropic-messages",
          models: data.map(m => ({
            id: m.id,
            reasoning: m.thinking_enabled ?? false,
            input: ["text", "image"] as ("text" | "image")[],
            contextWindow: m.max_tokens ?? 200000,
            maxTokens: m.thinking_enabled ? Math.min(m.max_tokens ?? 128000, 128000) : Math.min(m.max_tokens ?? 8192, 16384),
          })).sort((a: DiscoveredModel, b: DiscoveredModel) => a.id.localeCompare(b.id)),
        };
      }
    }
  } catch { /* fall through */ }

  // Try Google-style
  if (provider === "google") {
    try {
      const res = await fetch(`${base}/v1beta/models?key=${resolvedKey}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json() as { models?: any[] };
        const data = (json.models ?? []).filter((m: any) => m.name?.includes("gemini"));
        if (data.length > 0) {
          return {
            api: "google-generative-ai",
            models: data.map((m: any) => ({
              id: m.name.replace("models/", ""),
              reasoning: m.name.includes("thinking") || m.name.includes("2.5"),
              input: ["text", "image"] as ("text" | "image")[],
              contextWindow: m.inputTokenLimit ?? 1048576,
              maxTokens: m.outputTokenLimit ?? 65536,
            })).sort((a: DiscoveredModel, b: DiscoveredModel) => a.id.localeCompare(b.id)),
          };
        }
      }
    } catch { /* fall through */ }
  }

  // Try OpenAI-compatible
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${resolvedKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = await res.json() as { data?: any[] };
      const data = json.data ?? [];
      if (data.length > 0) {
        return {
          api: "openai-completions",
          models: data.map((m: any) => ({
            id: m.id,
            reasoning: m.thinking_enabled ?? m.id.includes("o3"),
            input: ["text", "image"] as ("text" | "image")[],
            contextWindow: m.context_window ?? m.max_tokens ?? 128000,
            maxTokens: m.max_output ?? 16384,
          })).sort((a: DiscoveredModel, b: DiscoveredModel) => a.id.localeCompare(b.id)),
        };
      }
    }
  } catch { /* fall through */ }

  return { models: [] };
}

/**
 * Interactively configure API providers, detecting existing keys, allowing multi-select, and supporting custom endpoints.
 * @param env - Current environment info with detected providers
 * @returns Configured provider list
 */
export async function setupProviders(env?: EnvInfo): Promise<ProviderConfig[]> {
  const entries = Object.entries(PROVIDERS);

  // Detect existing providers — offer skip or add new
  const detected = env?.existingProviders ?? [];
  if (detected.length > 0) {
    const action = await p.select({
      message: t("provider.detected", { list: detected.join(", ") }),
      options: [
        { value: "skip",  label: t("provider.detectedSkip"),  hint: t("provider.detectedSkipHint") },
        { value: "add",   label: t("provider.detectedAdd"),   hint: t("provider.detectedAddHint") },
      ],
    });
    if (p.isCancel(action)) { p.cancel(t("cancelled")); process.exit(0); }
    if (action === "skip") return [];
  }

  const selected = await p.multiselect({
    message: t("provider.select"),
    options: [
      ...entries.map(([key, info]) => ({ value: key, label: info.label, hint: info.env })),
      { value: "_custom", label: t("provider.custom"), hint: t("provider.customHint") },
    ],
    initialValues: ["anthropic"],
    required: true,
  });
  if (p.isCancel(selected)) { p.cancel(t("cancelled")); process.exit(0); }

  const configs: ProviderConfig[] = [];

  for (const name of selected) {
    if (name === "_custom") {
      const custom = await setupCustomProvider();
      if (custom) configs.push(custom);
      continue;
    }

    const info = PROVIDERS[name]!;
    const envVal = process.env[info.env];

    // Ask if user wants a custom endpoint for this provider
    const useCustomUrl = await p.confirm({
      message: t("provider.useCustomUrl", { label: info.label }),
      initialValue: false,
    });
    if (p.isCancel(useCustomUrl)) { p.cancel(t("cancelled")); process.exit(0); }

    let baseUrl: string | undefined;
    if (useCustomUrl) {
      const url = await p.text({
        message: t("provider.baseUrl", { label: info.label }),
        placeholder: "https://proxy.example.com",
        validate: (v) => (!v || !v.startsWith("http")) ? t("provider.baseUrlValidation") : isUnsafeUrl(v) ? "URL must use HTTPS for remote hosts (private IPs blocked)" : undefined,
      });
      if (p.isCancel(url)) { p.cancel(t("cancelled")); process.exit(0); }
      baseUrl = url;
    }

    let apiKey: string;
    if (envVal && !baseUrl) {
      const useEnv = await p.confirm({ message: t("provider.foundEnv", { env: chalk.cyan(info.env) }) });
      if (p.isCancel(useEnv)) { p.cancel(t("cancelled")); process.exit(0); }
      apiKey = useEnv ? info.env : await promptKey(info.label);
    } else {
      apiKey = await promptKey(info.label);
    }

    // Dynamic model fetch — always try
    const fetchUrl = baseUrl || PROVIDER_API_URLS[name];
    const { defaultModel, discoveredModels, api } = await selectModelWithMeta(name, info.label, info.models, fetchUrl, apiKey);

    configs.push({ name, apiKey, defaultModel, baseUrl, api, discoveredModels });
    p.log.success(t("provider.configured", { label: info.label }));
  }

  return configs;
}

/**
 * Interactively configure a custom provider (Ollama, vLLM, or other OpenAI-compatible endpoints).
 * @returns Custom provider config, or null if cancelled
 */
async function setupCustomProvider(): Promise<ProviderConfig | null> {
  const name = await p.text({
    message: t("provider.name"),
    placeholder: t("provider.namePlaceholder"),
    validate: (v) => (!v || v.trim().length === 0) ? t("provider.nameRequired") : undefined,
  });
  if (p.isCancel(name)) { p.cancel(t("cancelled")); process.exit(0); }

  const baseUrl = await p.text({
    message: t("provider.baseUrlCustom"),
    placeholder: t("provider.baseUrlCustomPlaceholder"),
    validate: (v) => (!v || !v.startsWith("http")) ? t("provider.baseUrlValidation") : isUnsafeUrl(v) ? "URL must use HTTPS for remote hosts (private IPs blocked)" : undefined,
  });
  if (p.isCancel(baseUrl)) { p.cancel(t("cancelled")); process.exit(0); }

  const needsKey = await p.confirm({ message: t("provider.needsKey"), initialValue: false });
  if (p.isCancel(needsKey)) { p.cancel(t("cancelled")); process.exit(0); }

  let apiKey = "none";
  if (needsKey) {
    apiKey = await promptKey(name);
  }

  const { defaultModel, discoveredModels, api } = await selectModelWithMeta(name, name, [], baseUrl, apiKey);

  p.log.success(t("provider.customConfigured", { name, url: baseUrl }));

  return { name, apiKey, defaultModel, baseUrl, api, discoveredModels };
}

interface SelectResult {
  defaultModel: string;
  discoveredModels?: DiscoveredModel[];
  api?: string;
}

/**
 * Select a default model by dynamically fetching available models, falling back to a static list or manual input.
 * @param provider - Provider name
 * @param label - Provider display label
 * @param staticModels - Static model list fallback
 * @param baseUrl - API base URL
 * @param apiKey - API key
 * @returns Selected model and discovered model metadata
 */
async function selectModelWithMeta(provider: string, label: string, staticModels: string[], baseUrl?: string, apiKey?: string): Promise<SelectResult> {
  let modelIds = staticModels;
  let discoveredModels: DiscoveredModel[] | undefined;
  let api: string | undefined;

  if (baseUrl && apiKey) {
    const s = p.spinner();
    s.start(t("provider.fetchingModels", { source: label }));
    const result = await fetchModels(provider, baseUrl, apiKey);
    s.stop(result.models.length > 0 ? t("provider.foundModels", { count: result.models.length }) : t("provider.defaultModelList"));
    if (result.models.length > 0) {
      discoveredModels = result.models;
      api = result.api;
      modelIds = result.models.map(m => m.id);
    }
  }

  if (modelIds.length === 0) {
    const model = await p.text({
      message: t("provider.modelName", { label }),
      placeholder: t("provider.modelNamePlaceholder"),
      validate: (v) => (!v || v.trim().length === 0) ? t("provider.modelNameRequired") : undefined,
    });
    if (p.isCancel(model)) { p.cancel(t("cancelled")); process.exit(0); }
    return { defaultModel: model, discoveredModels, api };
  }

  if (modelIds.length === 1) return { defaultModel: modelIds[0], discoveredModels, api };

  const model = await p.select({
    message: t("provider.selectModel", { label }),
    options: modelIds.slice(0, 50).map(m => ({ value: m, label: m })),
  });
  if (p.isCancel(model)) { p.cancel(t("cancelled")); process.exit(0); }
  return { defaultModel: model, discoveredModels, api };
}

/**
 * Prompt the user to enter an API key.
 * @param label - Provider display label
 * @returns The entered API key
 */
async function promptKey(label: string): Promise<string> {
  const key = await p.password({
    message: t("provider.apiKey", { label }),
    validate: (v) => (!v || v.trim().length === 0) ? t("provider.apiKeyRequired") : undefined,
  });
  if (p.isCancel(key)) { p.cancel(t("cancelled")); process.exit(0); }
  return key;
}
