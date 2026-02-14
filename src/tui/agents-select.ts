import * as p from "@clack/prompts";
import { t } from "../i18n.js";

export async function selectAgents(): Promise<string> {
  const agent = await p.select({
    message: t("agent.select"),
    options: [
      { value: "general-developer",  label: t("agent.general"),   hint: t("agent.generalHint") },
      { value: "fullstack-developer", label: t("agent.fullstack"), hint: t("agent.fullstackHint") },
      { value: "security-researcher", label: t("agent.security"),  hint: t("agent.securityHint") },
      { value: "data-ai-engineer",    label: t("agent.dataai"),    hint: t("agent.dataaiHint") },
      { value: "colony-operator",     label: t("agent.colony"),    hint: t("agent.colonyHint") },
    ],
  });
  if (p.isCancel(agent)) { p.cancel(t("cancelled")); process.exit(0); }
  return agent;
}
