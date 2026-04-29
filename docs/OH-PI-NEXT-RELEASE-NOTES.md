# `oh-pi` Next Release Compatibility Messaging

This note defines how the next `oh-pi` release should communicate its legacy/bridge role more clearly.

## Goal

Make sure users understand:
- `pi-agent-colony` is now the canonical package/repository name
- `oh-pi` still works during transition
- `oh-pi` is now a compatibility/bootstrap bridge, not the long-term canonical identifier

## Recommended changes for the next `oh-pi` release

### 1. Package description

Current direction should become more explicit, for example:

> Legacy/bootstrap compatibility package for Agent Colony for Pi. New installs should prefer `pi-agent-colony`.

### 2. README first-screen note

Add a short note near the top:

> Looking for the canonical package? Use `pi-agent-colony`. `oh-pi` remains available during the migration window.

### 3. Release notes wording

Each `oh-pi` transition release should include:
- canonical install commands first
- old commands second
- a one-paragraph migration explanation

### 4. Optional runtime notice

If appropriate later, the bootstrap CLI can emit a short non-blocking message such as:

```text
[Agent Colony] `oh-pi` is still supported during migration.
Prefer `pi-agent-colony` for new installs.
```

This should be:
- short
- non-fatal
- easy to remove later

## Recommended install order in docs

Always show this order:

```bash
npx pi-agent-colony
pi install npm:pi-agent-colony
```

Then show legacy-compatible alternatives:

```bash
npx oh-pi
pi install npm:oh-pi
```

## Recommendation

Do not deprecate `oh-pi` aggressively yet.

Instead, the next release should make `oh-pi` feel like a supported bridge with clearer migration wording.
