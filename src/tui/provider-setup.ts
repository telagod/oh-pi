import * as p from "@clack/prompts";
import chalk from "chalk";
import { PROVIDERS, type ProviderConfig } from "../types.js";

/** Fetch models from OpenAI-compatible /v1/models endpoint */
async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/models`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: { id: string }[] };
    return (json.data ?? []).map(m => m.id).sort();
  } catch { return []; }
}

export async function setupProviders(): Promise<ProviderConfig[]> {
  const entries = Object.entries(PROVIDERS);

  const selected = await p.multiselect({
    message: "Select API providers",
    options: [
      ...entries.map(([key, info]) => ({ value: key, label: info.label, hint: info.env })),
      { value: "_custom", label: "🔧 Custom endpoint", hint: "Ollama, vLLM, LiteLLM, any OpenAI-compatible" },
    ],
    initialValues: ["anthropic"],
    required: true,
  });
  if (p.isCancel(selected)) { p.cancel("Cancelled."); process.exit(0); }

  const configs: ProviderConfig[] = [];

  for (const name of selected) {
    if (name === "_custom") {
      const custom = await setupCustomProvider();
      if (custom) configs.push(custom);
      continue;
    }

    const info = PROVIDERS[name]!;
    const envVal = process.env[info.env];

    let apiKey: string;
    if (envVal) {
      const useEnv = await p.confirm({ message: `Found ${chalk.cyan(info.env)} in environment. Use it?` });
      if (p.isCancel(useEnv)) { p.cancel("Cancelled."); process.exit(0); }
      apiKey = useEnv ? info.env : await promptKey(info.label);
    } else {
      apiKey = await promptKey(info.label);
    }

    // Ask for custom base URL (optional)
    const wantCustomUrl = await p.confirm({
      message: `Custom endpoint for ${info.label}? (proxy, Azure, etc.)`,
      initialValue: false,
    });
    if (p.isCancel(wantCustomUrl)) { p.cancel("Cancelled."); process.exit(0); }

    let baseUrl: string | undefined;
    if (wantCustomUrl) {
      const url = await p.text({
        message: `Base URL for ${info.label}:`,
        placeholder: "https://your-proxy.example.com",
        validate: (v) => (!v || !v.startsWith("http")) ? "Must be a valid URL" : undefined,
      });
      if (p.isCancel(url)) { p.cancel("Cancelled."); process.exit(0); }
      baseUrl = url;
    }

    // Model selection — try dynamic fetch, fall back to static list
    const defaultModel = await selectModel(info.label, info.models, baseUrl, apiKey);

    configs.push({ name, apiKey, defaultModel, ...(baseUrl ? { baseUrl } : {}) });
    p.log.success(`${info.label} configured`);
  }

  return configs;
}

async function setupCustomProvider(): Promise<ProviderConfig | null> {
  const name = await p.text({
    message: "Provider name:",
    placeholder: "ollama",
    validate: (v) => (!v || v.trim().length === 0) ? "Name required" : undefined,
  });
  if (p.isCancel(name)) { p.cancel("Cancelled."); process.exit(0); }

  const baseUrl = await p.text({
    message: "Base URL:",
    placeholder: "http://localhost:11434",
    validate: (v) => (!v || !v.startsWith("http")) ? "Must be a valid URL" : undefined,
  });
  if (p.isCancel(baseUrl)) { p.cancel("Cancelled."); process.exit(0); }

  const needsKey = await p.confirm({ message: "Requires API key?", initialValue: false });
  if (p.isCancel(needsKey)) { p.cancel("Cancelled."); process.exit(0); }

  let apiKey = "none";
  if (needsKey) {
    apiKey = await promptKey(name);
  }

  // Dynamic model fetch
  const s = p.spinner();
  s.start(`Fetching models from ${baseUrl}`);
  const models = await fetchModels(baseUrl, apiKey);
  s.stop(models.length > 0 ? `Found ${models.length} models` : "No models found via API");

  let defaultModel: string | undefined;
  if (models.length > 0) {
    const model = await p.select({
      message: `Default model for ${name}:`,
      options: models.slice(0, 30).map(m => ({ value: m, label: m })),
    });
    if (p.isCancel(model)) { p.cancel("Cancelled."); process.exit(0); }
    defaultModel = model;
  } else {
    const model = await p.text({
      message: `Model name for ${name}:`,
      placeholder: "llama3.1:8b",
      validate: (v) => (!v || v.trim().length === 0) ? "Model name required" : undefined,
    });
    if (p.isCancel(model)) { p.cancel("Cancelled."); process.exit(0); }
    defaultModel = model;
  }

  p.log.success(`${name} configured (${baseUrl})`);
  return { name, apiKey, defaultModel, baseUrl };
}

async function selectModel(label: string, staticModels: string[], baseUrl?: string, apiKey?: string): Promise<string> {
  let models = staticModels;

  // Try dynamic fetch if custom URL or known provider
  if (baseUrl && apiKey) {
    const s = p.spinner();
    s.start(`Fetching models from ${label}`);
    const fetched = await fetchModels(baseUrl, apiKey);
    s.stop(fetched.length > 0 ? `Found ${fetched.length} models` : "Using default model list");
    if (fetched.length > 0) models = fetched;
  }

  if (models.length === 1) return models[0];

  const model = await p.select({
    message: `Default model for ${label}:`,
    options: models.slice(0, 30).map(m => ({ value: m, label: m })),
  });
  if (p.isCancel(model)) { p.cancel("Cancelled."); process.exit(0); }
  return model;
}

async function promptKey(label: string): Promise<string> {
  const key = await p.password({
    message: `API key for ${label}:`,
    validate: (v) => (!v || v.trim().length === 0) ? "API key cannot be empty" : undefined,
  });
  if (p.isCancel(key)) { p.cancel("Cancelled."); process.exit(0); }
  return key;
}
