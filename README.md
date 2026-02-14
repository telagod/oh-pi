<div align="center">

# 🐜 oh-pi

**One command to supercharge [pi-coding-agent](https://github.com/badlogic/pi-mono).**

Like oh-my-zsh for pi — but with an autonomous ant colony.

[![npm](https://img.shields.io/npm/v/oh-pi)](https://www.npmjs.com/package/oh-pi)
[![license](https://img.shields.io/npm/l/oh-pi)](./LICENSE)
[![node](https://img.shields.io/node/v/oh-pi)](https://nodejs.org)

```bash
npx oh-pi
```

</div>

---

## Why

pi-coding-agent is powerful out of the box. But configuring providers, themes, extensions, skills, and prompts by hand is tedious. oh-pi gives you a modern TUI that does it all in under a minute — and ships an **ant colony swarm** that turns pi into a multi-agent system.

## Quick Start

```bash
npx oh-pi    # configure everything
pi           # start coding
```

That's it. oh-pi detects your environment, walks you through setup, and writes `~/.pi/agent/` for you.

Already have a config? oh-pi detects it and offers **backup before overwriting**.

## What You Get

```
~/.pi/agent/
├── auth.json            API keys (0600 permissions)
├── settings.json        Model, theme, thinking level
├── keybindings.json     Vim/Emacs shortcuts (optional)
├── AGENTS.md            Role-specific AI guidelines
├── extensions/          4 extensions
│   ├── safe-guard       Dangerous command confirmation + path protection
│   ├── git-guard        Auto stash checkpoints + dirty repo warning
│   ├── auto-session     Session naming from first message
│   └── ant-colony/      🐜 Autonomous multi-agent swarm
├── prompts/             10 templates (/review /fix /commit /test ...)
├── skills/              4 skills (debug, git, setup, colony)
└── themes/              6 custom themes
```

## Setup Modes

| Mode | Steps | For |
|------|-------|-----|
| 🚀 **Quick** | 3 | Pick provider → enter key → done |
| 📦 **Preset** | 2 | Choose a role profile → enter key |
| 🎛️ **Custom** | 6 | Pick everything yourself |

### Presets

| | Theme | Thinking | Includes |
|---|-------|----------|----------|
| 🟢 Starter | oh-pi Dark | medium | Safety + git basics |
| 🔵 Pro Developer | Catppuccin | high | Full toolchain |
| 🟣 Security Researcher | Cyberpunk | high | Audit + pentesting |
| 🟠 Data & AI | Tokyo Night | medium | MLOps + pipelines |
| 🔴 Minimal | Default | off | Core only |
| ⚫ Full Power | oh-pi Dark | high | Everything + ant colony |

### Providers

Anthropic · OpenAI · Google Gemini · Groq · OpenRouter · xAI · Mistral

Auto-detects API keys from environment variables.

## 🐜 Ant Colony

The headline feature. A multi-agent swarm modeled after real ant ecology.

```
You: "Refactor auth from sessions to JWT"

oh-pi:
  🔍 Scout ants explore codebase (haiku — fast, cheap)
  📋 Task pool generated from discoveries
  ⚒️  Worker ants execute in parallel (sonnet — capable)
  🛡️ Soldier ants review all changes (sonnet — thorough)
  ✅ Done — summary report with metrics
```

### Why ants?

Real ant colonies solve complex problems without central control. Each ant follows simple rules, communicates through **pheromone trails**, and the colony self-organizes. oh-pi maps this directly:

| Real Ants | oh-pi |
|-----------|-------|
| Scout finds food | Scout scans codebase, identifies targets |
| Pheromone trail | `.ant-colony/pheromone.jsonl` — shared discoveries |
| Worker carries food | Worker executes task on assigned files |
| Soldier guards nest | Soldier reviews changes, requests fixes |
| More food → more ants | More tasks → higher concurrency (auto-adapted) |
| Pheromone evaporates | 10-minute half-life — stale info fades |

### Auto-trigger

The LLM decides when to deploy the colony. You don't have to think about it:

- **≥3 files** need changes → colony
- **Parallel workstreams** possible → colony
- **Single file** change → direct execution (no colony overhead)

Or trigger manually:

```
/colony migrate the entire project from CJS to ESM
```

### Adaptive Concurrency

The colony automatically finds the optimal parallelism for your machine:

```
Cold start     →  1-2 ants (conservative)
Exploration    →  +1 each wave, monitoring throughput
Throughput ↓   →  lock optimal, stabilize
CPU > 85%      →  reduce immediately
429 rate limit →  halve concurrency + exponential backoff (15s→30s→60s)
Tasks done     →  scale down to minimum
```

### File Safety

One ant per file. Always. Conflicting tasks are automatically blocked and resume when locks release.

## Themes

| | |
|---|---|
| 🌙 **oh-pi Dark** | Cyan + purple, high contrast |
| 🌙 **Cyberpunk** | Neon magenta + electric cyan |
| 🌙 **Nord** | Arctic blue palette |
| 🌙 **Catppuccin Mocha** | Pastel on dark |
| 🌙 **Tokyo Night** | Blue + purple twilight |
| 🌙 **Gruvbox Dark** | Warm retro tones |

## Prompt Templates

```
/review    Code review: bugs, security, performance
/fix       Fix errors with minimal changes
/explain   Explain code, simple to detailed
/refactor  Refactor preserving behavior
/test      Generate tests
/commit    Conventional Commit message
/pr        Pull request description
/security  OWASP security audit
/optimize  Performance optimization
/document  Generate documentation
```

## AGENTS.md Templates

| Template | Focus |
|----------|-------|
| General Developer | Universal coding guidelines |
| Full-Stack Developer | Frontend + backend + DB |
| Security Researcher | Pentesting & audit |
| Data & AI Engineer | MLOps & pipelines |
| 🐜 Colony Operator | Multi-agent orchestration |

## Also a Pi Package

Skip the configurator, just install the resources:

```bash
pi install npm:oh-pi
```

Adds all themes, prompts, skills, and extensions to your existing pi setup.

## Requirements

- Node.js ≥ 20
- At least one LLM API key
- pi-coding-agent (installed automatically if missing)

## License

MIT
