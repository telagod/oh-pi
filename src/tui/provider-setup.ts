import * as p from "@clack/prompts";
import chalk from "chalk";
import { PROVIDERS, type ProviderConfig } from "../types.js";

export async function setupProviders(): Promise<ProviderConfig[]> {
  const entries = Object.entries(PROVIDERS);

  const selected = await p.multiselect({
    message: "Select API providers",
    options: entries.map(([key, info]) => ({
      value: key,
      label: info.label,
      hint: info.env,
    })),
    initialValues: ["anthropic"],
    required: true,
  });
  if (p.isCancel(selected)) { p.cancel("Cancelled."); process.exit(0); }

  const configs: ProviderConfig[] = [];

  for (const name of selected) {
    const info = PROVIDERS[name]!;
    const envVal = process.env[info.env];

    let apiKey: string;
    if (envVal) {
      const useEnv = await p.confirm({
        message: `Found ${chalk.cyan(info.env)} in environment. Use it?`,
      });
      if (p.isCancel(useEnv)) { p.cancel("Cancelled."); process.exit(0); }
      apiKey = useEnv ? info.env : await promptKey(info);
    } else {
      apiKey = await promptKey(info);
    }

    let defaultModel: string | undefined;
    if (info.models.length > 1) {
      const model = await p.select({
        message: `Default model for ${info.label}:`,
        options: info.models.map(m => ({ value: m, label: m })),
      });
      if (p.isCancel(model)) { p.cancel("Cancelled."); process.exit(0); }
      defaultModel = model;
    } else {
      defaultModel = info.models[0];
    }

    configs.push({ name, apiKey, defaultModel });
    p.log.success(`${info.label} configured`);
  }

  return configs;
}

async function promptKey(info: { label: string; env: string }): Promise<string> {
  const key = await p.password({
    message: `API key for ${info.label}:`,
    validate: (v) => (!v || v.trim().length === 0) ? "API key cannot be empty" : undefined,
  });
  if (p.isCancel(key)) { p.cancel("Cancelled."); process.exit(0); }
  return key;
}
