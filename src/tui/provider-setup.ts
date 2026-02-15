import * as p from "@clack/prompts";
import chalk from "chalk";
import { t } from "../i18n.js";
import { PROVIDERS, type ProviderConfig } from "../types.js";
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

/** Fetch models dynamically — tries multiple API styles */
async function fetchModels(provider: string, baseUrl: string, apiKey: string): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const resolvedKey = process.env[apiKey] ?? apiKey;

  // Try Anthropic-style: GET /v1/models with x-api-key header
  if (provider === "anthropic") {
    try {
      const res = await fetch(`${base}/v1/models`, {
        headers: { "x-api-key": resolvedKey, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json() as { data?: { id: string }[] };
        const models = (json.data ?? []).map(m => m.id).sort();
        if (models.length > 0) return models;
      }
    } catch { /* fall through */ }
  }

  // Try Google-style: GET /v1beta/models with key param
  if (provider === "google") {
    try {
      const res = await fetch(`${base}/v1beta/models?key=${resolvedKey}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json() as { models?: { name: string }[] };
        const models = (json.models ?? [])
          .map(m => m.name.replace("models/", ""))
          .filter(m => m.includes("gemini"))
          .sort();
        if (models.length > 0) return models;
      }
    } catch { /* fall through */ }
  }

  // Try OpenAI-compatible: GET /v1/models with Bearer auth
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${resolvedKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = await res.json() as { data?: { id: string }[] };
      const models = (json.data ?? []).map(m => m.id).sort();
      if (models.length > 0) return models;
    }
  } catch { /* fall through */ }

  return [];
}

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
        validate: (v) => (!v || !v.startsWith("http")) ? t("provider.baseUrlValidation") : undefined,
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

    // Dynamic model fetch — always try, fall back to static list
    const fetchUrl = baseUrl || PROVIDER_API_URLS[name];
    const defaultModel = await selectModel(name, info.label, info.models, fetchUrl, apiKey);

    configs.push({ name, apiKey, defaultModel, baseUrl });
    p.log.success(t("provider.configured", { label: info.label }));
  }

  return configs;
}

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
    validate: (v) => (!v || !v.startsWith("http")) ? t("provider.baseUrlValidation") : undefined,
  });
  if (p.isCancel(baseUrl)) { p.cancel(t("cancelled")); process.exit(0); }

  const needsKey = await p.confirm({ message: t("provider.needsKey"), initialValue: false });
  if (p.isCancel(needsKey)) { p.cancel(t("cancelled")); process.exit(0); }

  let apiKey = "none";
  if (needsKey) {
    apiKey = await promptKey(name);
  }

  // Dynamic model fetch
  const defaultModel = await selectModel(name, name, [], baseUrl, apiKey);

  p.log.success(t("provider.customConfigured", { name, url: baseUrl }));

  return { name, apiKey, defaultModel, baseUrl };
}

async function selectModel(provider: string, label: string, staticModels: string[], baseUrl?: string, apiKey?: string): Promise<string> {
  let models = staticModels;

  // Always try dynamic fetch
  if (baseUrl && apiKey) {
    const s = p.spinner();
    s.start(t("provider.fetchingModels", { source: label }));
    const fetched = await fetchModels(provider, baseUrl, apiKey);
    s.stop(fetched.length > 0 ? t("provider.foundModels", { count: fetched.length }) : t("provider.defaultModelList"));
    if (fetched.length > 0) models = fetched;
  }

  if (models.length === 0) {
    // No models found — manual input
    const model = await p.text({
      message: t("provider.modelName", { label }),
      placeholder: t("provider.modelNamePlaceholder"),
      validate: (v) => (!v || v.trim().length === 0) ? t("provider.modelNameRequired") : undefined,
    });
    if (p.isCancel(model)) { p.cancel(t("cancelled")); process.exit(0); }
    return model;
  }

  if (models.length === 1) return models[0];

  const model = await p.select({
    message: t("provider.selectModel", { label }),
    options: models.slice(0, 50).map(m => ({ value: m, label: m })),
  });
  if (p.isCancel(model)) { p.cancel(t("cancelled")); process.exit(0); }
  return model;
}

async function promptKey(label: string): Promise<string> {
  const key = await p.password({
    message: t("provider.apiKey", { label }),
    validate: (v) => (!v || v.trim().length === 0) ? t("provider.apiKeyRequired") : undefined,
  });
  if (p.isCancel(key)) { p.cancel(t("cancelled")); process.exit(0); }
  return key;
}
