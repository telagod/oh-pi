import * as p from "@clack/prompts";

export async function selectAgents(): Promise<string> {
  const agent = await p.select({
    message: "AGENTS.md template:",
    options: [
      { value: "general-developer",  label: "📋 General Developer",    hint: "Universal coding guidelines" },
      { value: "fullstack-developer", label: "🏗️  Full-Stack Developer", hint: "Frontend + Backend + DB" },
      { value: "security-researcher", label: "🔒 Security Researcher",  hint: "Pentesting & audit" },
      { value: "data-ai-engineer",    label: "🤖 Data & AI Engineer",   hint: "MLOps & pipelines" },
      { value: "colony-operator",     label: "🐜 Colony Operator",      hint: "Ant swarm multi-agent" },
    ],
  });
  if (p.isCancel(agent)) { p.cancel("Cancelled."); process.exit(0); }
  return agent;
}
