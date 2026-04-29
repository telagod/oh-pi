# Release Notes - v0.1.85

## Agent Colony for Pi Beta

This release turns the repository into a clearer **colony-first product** and now also completes the first canonical rename step.

Current naming model:
- **Brand:** Agent Colony
- **Formal product name:** Agent Colony for Pi
- **Canonical repo/package:** `pi-agent-colony`
- **Legacy compatibility package:** `oh-pi`

## Canonical install path

New installs should prefer:

```bash
npx pi-agent-colony
pi install npm:pi-agent-colony
```

Legacy-compatible transition path:

```bash
npx oh-pi
pi install npm:oh-pi
```

## What is ready now

- Thin extension entry for the ant-colony plugin
- Real `core/` and `pi/` layering in code, not just naming
- Background colony execution with passive progress signals
- Status, stop, resume, and detail panel support
- Planning recovery, review loop, adaptive concurrency, and checkpoint resume
- Compatibility wrappers preserved for existing import paths
- Canonical GitHub repo rename to `pi-agent-colony`
- Canonical npm package publish as `pi-agent-colony`

## What this release is not claiming

This is a **Beta**, not a 1.0 GA release.

It is suitable for:
- multi-file refactors
- cross-module feature work
- parallelizable coding tasks
- execution flows that benefit from scouting, review, and recovery

It is not yet positioned as:
- fully benchmarked across all providers
- production-proven in every Pi environment
- a locked stable API surface for long-term plugin consumers

## Recommended user framing

Use Agent Colony when the task:
- spans 3+ files
- can be decomposed into sub-tasks
- benefits from parallel workers and post-change review

Use plain Pi when the task:
- is a small single-file fix
- needs step-by-step human control
- is mostly explanation or Q&A

## Validation snapshot

- `npm test`
- **21/21 test files passed**
- **235/235 tests passed**

## Migration note

The project is moving from the legacy bootstrap name `oh-pi` to the canonical package/repository name `pi-agent-colony`.

Existing `oh-pi` users keep a compatibility path during the migration window.
