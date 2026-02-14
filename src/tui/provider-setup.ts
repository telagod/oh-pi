import * as p from "@clack/prompts";
import chalk from "chalk";
import { t } from "../i18n.js";
import { PROVIDERS, type ProviderConfig } from "../types.js";
import type { EnvInfo } from "../utils/detect.js";

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

    let apiKey: string;
    if (envVal) {
      const useEnv = await p.confirm({ message: t("provider.foundEnv", { env: chalk.cyan(info.env) }) });
      if (p.isCancel(useEnv)) { p.cancel(t("cancelled")); process.exit(0); }
      apiKey = useEnv ? info.env : await promptKey(info.label);
    } else {
      apiKey = await promptKey(info.label);
    }

    // Ask for custom base URL (optional)
    const wantCustomUrl = await p.confirm({
      message: t("provider.customEndpoint", { label: info.label }),
      initialValue: false,
    });
    if (p.isCancel(wantCustomUrl)) { p.cancel(t("cancelled")); process.exit(0); }

    let baseUrl: string | undefined;
    if (wantCustomUrl) {
      const url = await p.text({
        message: t("provider.baseUrl", { label: info.label }),
        placeholder: t("provider.baseUrlPlaceholder"),
        validate: (v) => (!v || !v.startsWith("http")) ? t("provider.baseUrlValidation") : undefined,
      });
      if (p.isCancel(url)) { p.cancel(t("cancelled")); process.exit(0); }
      baseUrl = url;
    }

    // Model selection — try dynamic fetch, fall back to static list
    const defaultModel = await selectModel(info.label, info.models, baseUrl, apiKey);

    configs.push({ name, apiKey, defaultModel, ...(baseUrl ? { baseUrl } : {}) });
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
  const s = p.spinner();
  s.start(t("provider.fetchingModels", { source: baseUrl }));
  const models = await fetchModels(baseUrl, apiKey);
  s.stop(models.length > 0 ? t("provider.foundModels", { count: models.length }) : t("provider.noModels"));

  let defaultModel: string | undefined;
  if (models.length > 0) {
    const model = await p.select({
      message: t("provider.selectModel", { label: name }),
      options: models.slice(0, 30).map(m => ({ value: m, label: m })),
    });
    if (p.isCancel(model)) { p.cancel(t("cancelled")); process.exit(0); }
    defaultModel = model;
  } else {
    const model = await p.text({
      message: t("provider.modelName", { label: name }),
      placeholder: t("provider.modelNamePlaceholder"),
      validate: (v) => (!v || v.trim().length === 0) ? t("provider.modelNameRequired") : undefined,
    });
    if (p.isCancel(model)) { p.cancel(t("cancelled")); process.exit(0); }
    defaultModel = model;
  }

  p.log.success(t("provider.customConfigured", { name, url: baseUrl }));

  // Model capabilities (optional)
  const wantCaps = await p.confirm({
    message: t("provider.configureCaps"),
    initialValue: false,
  });
  if (p.isCancel(wantCaps)) { p.cancel(t("cancelled")); process.exit(0); }

  let contextWindow: number | undefined;
  let maxTokens: number | undefined;
  let reasoning: boolean | undefined;
  let multimodal: boolean | undefined;

  if (wantCaps) {
    const ctxInput = await p.text({
      message: t("provider.contextWindow"),
      placeholder: "128000",
      initialValue: "128000",
      validate: (v) => {
        const n = Number(v);
        if (isNaN(n) || n < 1024) return t("provider.contextWindowValidation");
        return undefined;
      },
    });
    if (p.isCancel(ctxInput)) { p.cancel(t("cancelled")); process.exit(0); }
    contextWindow = Number(ctxInput);

    const maxTokInput = await p.text({
      message: t("provider.maxTokens"),
      placeholder: "8192",
      initialValue: "8192",
      validate: (v) => {
        const n = Number(v);
        if (isNaN(n) || n < 256) return t("provider.maxTokensValidation");
        return undefined;
      },
    });
    if (p.isCancel(maxTokInput)) { p.cancel(t("cancelled")); process.exit(0); }
    maxTokens = Number(maxTokInput);

    const isMultimodal = await p.confirm({ message: t("provider.multimodal"), initialValue: false });
    if (p.isCancel(isMultimodal)) { p.cancel(t("cancelled")); process.exit(0); }
    multimodal = isMultimodal;

    const isReasoning = await p.confirm({ message: t("provider.reasoning"), initialValue: false });
    if (p.isCancel(isReasoning)) { p.cancel(t("cancelled")); process.exit(0); }
    reasoning = isReasoning;
  }

  return { name, apiKey, defaultModel, baseUrl, contextWindow, maxTokens, reasoning, multimodal };
}

async function selectModel(label: string, staticModels: string[], baseUrl?: string, apiKey?: string): Promise<string> {
  let models = staticModels;

  // Try dynamic fetch if custom URL or known provider
  if (baseUrl && apiKey) {
    const s = p.spinner();
    s.start(t("provider.fetchingModels", { source: label }));
    const fetched = await fetchModels(baseUrl, apiKey);
    s.stop(fetched.length > 0 ? t("provider.foundModels", { count: fetched.length }) : t("provider.defaultModelList"));
    if (fetched.length > 0) models = fetched;
  }

  if (models.length === 1) return models[0];

  const model = await p.select({
    message: t("provider.selectModel", { label }),
    options: models.slice(0, 30).map(m => ({ value: m, label: m })),
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
