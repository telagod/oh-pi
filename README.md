<div align="center">

<img src="./logo.svg" width="180" alt="oh-pi logo"/>

# 🐜 oh-pi

**One command to supercharge [pi-coding-agent](https://github.com/badlogic/pi-mono).**

Like oh-my-zsh for pi — but with an autonomous ant colony.

[![npm](https://img.shields.io/npm/v/oh-pi)](https://www.npmjs.com/package/oh-pi)
[![license](https://img.shields.io/npm/l/oh-pi)](./LICENSE)
[![node](https://img.shields.io/node/v/oh-pi)](https://nodejs.org)

[English](./README.md) | [中文](./README.zh.md) | [Français](./README.fr.md)

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
├── extensions/          8 extensions (7 default + ant-colony)
│   ├── safe-guard       Dangerous command confirmation + path protection
│   ├── git-guard        Auto stash checkpoints + dirty repo warning
│   ├── auto-session     Session naming from first message
│   ├── custom-footer    Enhanced status bar (token/cost/time/git/cwd)
│   ├── compact-header   Streamlined startup info
│   ├── auto-update      Check for updates on launch
│   ├── bg-process       ⏳ **Bg Process** — Auto-background long-running commands (dev servers, etc.)
│   └── ant-colony/      🐜 Autonomous multi-agent swarm (optional)
├── prompts/             10 templates (/review /fix /commit /test ...)
├── skills/              11 skills (tools + UI design + workflows)
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
| ⚫ Full Power | oh-pi Dark | high | All extensions + bg-process + ant-colony |
| 🔴 Clean | Default | off | No extensions, just core |
| 🐜 Colony Only | oh-pi Dark | medium | Ant-colony with minimal setup |

### Providers

Anthropic · OpenAI · Google Gemini · Groq · OpenRouter · xAI · Mistral · [FOXNIO](https://www.foxnio.com) (recommended public-benefit Claude provider)

Auto-detects API keys from environment variables.

## 🐜 Ant Colony

The headline feature. A multi-agent swarm modeled after real ant ecology — deeply integrated into pi's SDK.

```
You: "Refactor auth from sessions to JWT"

oh-pi:
  🔍 Scout ants explore codebase (haiku — fast, cheap)
  📋 Task pool generated from discoveries
  ⚒️  Worker ants execute in parallel (sonnet — capable)
  🛡️ Soldier ants review all changes (sonnet — thorough)
  ✅ Done — report auto-injected into conversation
```

### Architecture

Each ant is an in-process `AgentSession` (pi SDK), not a child process:

```
pi (main process)
  └─ ant_colony tool
       └─ queen.ts → runColony()
            └─ spawnAnt() → createAgentSession()
                 ├─ session.subscribe() → real-time token stream
                 ├─ Zero startup overhead (shared process)
                 └─ Shared auth & model registry
```

**Interactive mode:** Colony runs in the background — you keep chatting. A live widget shows ant progress, and results are auto-injected when done.

**Print mode (`pi -p`):** Colony runs synchronously, blocks until complete.

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

### Real-time UI

In interactive mode, the colony shows live progress:

- **Status bar** — compact footer with real metrics: tasks done, active ants, tool calls, output tokens, cost, elapsed time
- **Ctrl+Shift+A** — overlay detail panel with task list, active ant streams, and colony log
- **Notification** — completion summary when done

Use `/colony-stop` to abort a running colony.

### Signal Protocol

The colony communicates with the main conversation via structured signals, preventing the LLM from polling or guessing colony status:

| Signal | Meaning |
|--------|---------|
| `COLONY_SIGNAL:LAUNCHED` | Colony started — don't poll |
| `COLONY_SIGNAL:RUNNING` | Colony active — injected each turn |
| `COLONY_SIGNAL:COMPLETE` | Colony finished — review report |
| `COLONY_SIGNAL:FAILED` | Colony crashed — report error |

### Turn Control

Each ant has a strict turn budget to prevent runaway execution:

Scout: 8 turns · Worker: 15 turns · Soldier: 8 turns

### Model Selection

The colony auto-detects available models and lets the LLM pick the best fit per role:

| Role | Strategy | Example |
|------|----------|---------|
| Scout | Fast & cheap — only reads, no edits | `claude-haiku-4-5`, `gpt-4o-mini` |
| Worker | Capable — makes code changes | `claude-sonnet-4-0`, `gpt-4o` |
| Soldier | Same as worker or slightly cheaper | `claude-sonnet-4-0` |

Omit model overrides to use the current session model for every ant.

### Cost Reporting

The colony tracks cost per ant and total spend, reported in the final summary. **Cost never interrupts execution** — turn limits and concurrency control handle resource management.

### Auto-trigger

The LLM decides when to deploy the colony. You don't have to think about it:

- **≥3 files** need changes → colony
- **Parallel workstreams** possible → colony
- **Single file** change → direct execution (no colony overhead)

### Adaptive Concurrency

The colony automatically finds the optimal parallelism for your machine:

```
Cold start     →  ceil(max/2) ants (fast ramp-up)
Exploration    →  +1 each wave, monitoring throughput
Throughput ↓   →  lock optimal, stabilize
CPU > 85%      →  reduce immediately
429 rate limit →  -1 concurrency + backoff (2s→5s→10s cap)
Tasks done     →  scale down to minimum
```

### File Safety

One ant per file. Always. Conflicting tasks are automatically blocked and resume when locks release.

## Skills

oh-pi ships 11 skills in three categories.

### 🔧 Tool Skills

Zero-dependency Node.js scripts — no API keys needed.

| Skill | What it does |
|-------|-------------|
| `context7` | Query latest library docs via Context7 API |
| `web-search` | DuckDuckGo search (free, no key) |
| `web-fetch` | Extract webpage content as plain text |

```bash
# Examples
./skills/context7/search.js "react"
./skills/web-search/search.js "typescript generics" -n 5
./skills/web-fetch/fetch.js https://example.com
```

### 🎨 UI Design System Skills

Complete design specs with CSS tokens, component examples, and design principles. The agent loads these when you ask for a specific visual style.

| Skill | Style | CSS Prefix |
|-------|-------|-----------|
| `liquid-glass` | Apple WWDC 2025 translucent glass | `--lg-` |
| `glassmorphism` | Frosted glass blur + transparency | `--glass-` |
| `claymorphism` | Soft 3D clay-like surfaces | `--clay-` |
| `neubrutalism` | Bold borders, offset shadows, high contrast | `--nb-` |

Each includes `references/tokens.css` with ready-to-use CSS custom properties.

```
You: "Build a dashboard with liquid glass style"
pi loads liquid-glass skill → applies --lg- tokens, glass effects, specular highlights
```

### 🔄 Workflow Skills

| Skill | What it does |
|-------|-------------|
| `quick-setup` | Detect project type, generate .pi/ config |
| `debug-helper` | Error analysis, log interpretation, profiling |
| `git-workflow` | Branching, commits, PRs, conflict resolution |
| `ant-colony` | Colony management commands and strategies |

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
