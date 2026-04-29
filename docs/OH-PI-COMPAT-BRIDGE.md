# `oh-pi` Compatibility Bridge Strategy

## Purpose

Define what `oh-pi` should mean after the canonical rename to `pi-agent-colony` begins.

## Recommendation

During the first migration phase, **do not break `oh-pi`**.

Instead:
- keep it installable
- keep it functional
- clearly mark it as the transition/bootstrap name
- point users toward `pi-agent-colony` as the canonical package

## Bridge model

### Phase 1 — full compatibility

`oh-pi` continues shipping the same effective functionality while docs start preferring `pi-agent-colony`.

This is the safest first migration step.

### Phase 2 — legacy-first messaging

`oh-pi` still works, but:
- README text becomes migration-oriented
- package description can mention legacy/transition status
- release notes point to canonical install commands first

### Phase 3 — optional deprecation

Only after adoption is established:
- optionally deprecate `oh-pi` on npm
- provide a clear install replacement message

## Recommended user promise

> Existing `oh-pi` users will keep a compatibility path during the rename transition. New users should prefer `pi-agent-colony` once published.

## What not to do initially

Do not:
- hard-break `npx oh-pi`
- remove package functionality immediately
- switch to deprecation-only mode on day one
- force migration before canonical package docs are stable

## Practical meaning

At the start of migration:
- `pi-agent-colony` = canonical package name
- `oh-pi` = compatibility bridge package
- Agent Colony = primary public product name
