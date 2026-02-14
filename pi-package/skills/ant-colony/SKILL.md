---
name: ant-colony
description: Ant colony multi-agent orchestration. Use when user needs parallel multi-file changes, large refactors, or complex features. Provides colony management commands and strategies.
---

# Ant Colony Skill

## When to Use
- Multi-file changes (≥3 files)
- Parallel workstreams
- Large refactors, migrations
- User says: colony, swarm, parallel, multi-agent

## Quick Start
```
/colony <goal>
```

## Colony Lifecycle
1. **Scout** — Explore codebase, identify targets, produce task pool
2. **Work** — Workers execute in parallel, adaptive concurrency
3. **Review** — Soldiers audit changes, request fixes if needed
4. **Fix** — Workers address review findings
5. **Done** — Summary report

## Strategies

### File-Scoped Decomposition (default)
Each worker owns distinct files. Zero conflict.
```
Worker A: [src/auth.ts, src/auth.test.ts]
Worker B: [src/api.ts, src/api.test.ts]
```

### Module-Scoped
Each worker owns a module directory.
```
Worker A: src/components/
Worker B: src/api/
```

### Pipeline
Sequential handoff when dependencies exist.
```
Scout → Worker(schema) → Worker(api) → Worker(ui) → Soldier
```

## Tuning
- `maxAnts`: Cap concurrent ants (default: auto-adapt to CPU)
- Colony auto-reduces concurrency on 429 rate limits
- Blocked tasks auto-resume when file locks release

## Extending Castes
Add custom ant types by editing `ant-colony/types.ts`:
```typescript
// In DEFAULT_ANT_CONFIGS, add:
mycaste: { caste: "mycaste", model: "...", tools: [...], maxTurns: 10 }
```
Then add matching prompt in `spawner.ts` CASTE_PROMPTS.
