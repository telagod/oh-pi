# oh-pi!

> One-click setup for [pi-coding-agent](https://github.com/badlogic/pi-mono). Like oh-my-zsh for pi.

```bash
npx oh-pi
```

## What it does

oh-pi! is a modern interactive TUI that configures pi-coding-agent in minutes:

- **API Key Setup** — Multi-provider configuration with validation (Anthropic, OpenAI, Google, Groq, OpenRouter, xAI, Mistral)
- **Preset Profiles** — Pre-made configs for different roles (Developer, Security, Data/AI, Colony Operator, Minimal)
- **Custom Themes** — 6 beautiful themes (oh-p! Dark, Cyberpunk, Nord, Catppuccin, Tokyo Night, Gruvbox)
- **Prompt Templates** — 10 ready-to-use templates (/review, /fix, /commit, /test, /security, etc.)
- **Extensions** — Safety guards, git checkpoints, auto session naming, ant colony swarm
- **Skills** — Debug helper, git workflow, quick project setup, ant colony orchestration
- **Keybindings** — Default, Vim, or Emacs schemes
- **AGENTS.md** — Role-specific project guidelines
- **🐜 Ant Colony** — Autonomous multi-agent swarm with adaptive concurrency

## Quick Start

```bash
# Run the configurator
npx oh-pi

# Then start coding
pi
```

## Setup Modes

### 🚀 Quick Setup (3 steps)
1. Pick your API provider(s)
2. Enter API key(s)
3. Done — sensible defaults applied

### 📦 Preset
Choose a pre-made profile:

| Preset | Theme | Thinking | Focus |
|--------|-------|----------|-------|
| 🟢 Starter | oh-p! Dark | medium | Basic safety + git |
| 🔵 Pro Developer | Catppuccin | high | Full toolchain |
| 🟣 Security Researcher | Cyberpunk | high | Audit + pentesting |
| 🟠 Data & AI Engineer | Tokyo Night | medium | MLOps + pipelines |
| 🔴 Minimal | Pi Default | off | Core only |
| ⚫ Full Power | oh-p! Dark | high | Everything + ant colony |

### 🎛️ Custom
Pick every option yourself: providers, theme, keybindings, extensions, skills, AGENTS.md template.

## 🐜 Ant Colony

Autonomous multi-agent swarm built as a pi extension. Modeled after real ant colony behavior.

### How it works

```
Goal → 🔍 Scouts explore → 📋 Task pool generated → ⚒️ Workers execute in parallel → 🛡️ Soldiers review → ✅ Done
```

- **Scouts** (haiku) — Fast codebase recon, identify targets
- **Workers** (sonnet) — Execute tasks, can spawn sub-tasks
- **Soldiers** (sonnet) — Review quality, request fixes if needed

### Key features

- **Auto-trigger** — LLM automatically deploys colony for complex multi-file tasks
- **Adaptive concurrency** — Starts at 1, explores throughput ceiling, stabilizes at optimal
- **429 backoff** — Rate limits trigger exponential backoff (15s→30s→60s) + concurrency halving
- **Pheromone communication** — Ants share discoveries via file-based pheromone trails (10min half-life)
- **File locking** — One ant per file, blocked tasks auto-resume when locks release

### Usage

```bash
# LLM auto-triggers for complex tasks
"Refactor the auth system from sessions to JWT"

# Manual command
/colony migrate the entire project from CJS to ESM

# Shortcut
Ctrl+Alt+A
```

## What Gets Installed

```
~/.pi/agent/
├── auth.json          # API keys (0600 permissions)
├── settings.json      # Model, theme, thinking level
├── keybindings.json   # Vim/Emacs shortcuts (if selected)
├── AGENTS.md          # Project guidelines for the AI
├── extensions/        # Safety guards, git tools, ant colony
├── prompts/           # /review, /fix, /commit, /test, etc.
├── skills/            # debug-helper, git-workflow, ant-colony
└── themes/            # Custom color themes
```

Existing config? oh-pi! detects it and offers backup before overwriting.

## Included Resources

### Themes

| Theme | Style |
|-------|-------|
| oh-p! Dark | Cyan + Purple, high contrast |
| Cyberpunk | Neon magenta + electric cyan |
| Nord | Arctic blue palette |
| Catppuccin Mocha | Pastel colors on dark |
| Tokyo Night | Blue + purple twilight |
| Gruvbox Dark | Warm retro tones |

### Prompt Templates

| Command | Description |
|---------|-------------|
| `/review` | Code review: bugs, security, performance |
| `/fix` | Fix errors with minimal changes |
| `/explain` | Explain code from simple to detailed |
| `/refactor` | Refactor while preserving behavior |
| `/test` | Generate tests for code |
| `/commit` | Conventional Commit message |
| `/pr` | Pull request description |
| `/security` | OWASP security audit |
| `/optimize` | Performance optimization |
| `/document` | Generate documentation |

### Extensions

| Extension | Description |
|-----------|-------------|
| Safe Guard | Confirms dangerous commands (rm -rf, DROP, etc.) + protects .env, .git/ |
| Git Guard | Auto stash checkpoints + dirty repo warning + completion notification |
| Auto Session Name | Names sessions from first message |
| 🐜 Ant Colony | Autonomous multi-agent swarm with adaptive concurrency |

### Skills

| Skill | Description |
|-------|-------------|
| `/skill:quick-setup` | Detect project type, generate .pi/ config |
| `/skill:debug-helper` | Error analysis, log interpretation, profiling |
| `/skill:git-workflow` | Branch strategy, PR workflow, conflict resolution |
| `/skill:ant-colony` | Colony orchestration strategies and tuning |

### AGENTS.md Templates

| Template | Description |
|----------|-------------|
| General Developer | Universal coding guidelines |
| Full-Stack Developer | Frontend + Backend + DB |
| Security Researcher | Pentesting & audit |
| Data & AI Engineer | MLOps & pipelines |
| 🐜 Colony Operator | Ant swarm multi-agent orchestration |

## Also a Pi Package

oh-pi! is also a pi package. Install just the resources without the configurator:

```bash
pi install npm:oh-pi
```

This adds all themes, prompts, skills, and extensions to your pi setup.

## Requirements

- Node.js >= 20
- pi-coding-agent (installed automatically if missing)
- At least one LLM API key

## License

MIT
