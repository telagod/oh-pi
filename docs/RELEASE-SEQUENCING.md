# Rename Release Sequencing

This document defines the practical release order for migrating from `oh-pi` to `pi-agent-colony`.

## Goal

Move to:
- **Brand:** Agent Colony
- **Formal name:** Agent Colony for Pi
- **Canonical repo/package:** `pi-agent-colony`

Without breaking existing users abruptly.

---

## Sequence

### Step 1 — Public clarification

Already in progress / mostly done:
- product naming shifted toward Agent Colony
- README clarification added
- rename planning docs added
- user confusion issue answered

### Step 2 — Prepare new package and repo identity

Do next:
- rename GitHub repository to `pi-agent-colony`
- update repository description/about text
- prepare npm package metadata for `pi-agent-colony`
- update badges and install examples for dual-name period

### Step 3 — Publish canonical package

Publish new package:

```bash
npm publish --access public
```

for the new canonical package name:

```text
pi-agent-colony
```

At this point docs should begin preferring:

```bash
npx pi-agent-colony
pi install npm:pi-agent-colony
```

### Step 4 — Keep `oh-pi` as compatibility bridge

After canonical package publish:
- keep `oh-pi` installable
- update `oh-pi` README/package messaging to point to `pi-agent-colony`
- keep old install commands documented as legacy-compatible

Optional follow-up actions:
- add npm deprecation notice later, not immediately
- add explicit migration message in release notes

### Step 5 — Migration release

Create a GitHub release dedicated to the rename:
- title example: `Rename Transition: oh-pi → pi-agent-colony`
- explain old vs new commands
- explain compatibility window
- explain that product branding is Agent Colony

### Step 6 — Compatibility window

Recommended transition window:
- keep both names working for at least one clear release cycle
- only de-emphasize `oh-pi` after canonical package usage is established

### Step 7 — Deprecation / cleanup

Only after transition is stable:
- move `oh-pi` to legacy status
- optionally deprecate old npm package with install guidance
- remove old-name-first wording from README and docs

---

## Practical command plan

### Before canonical package exists

```bash
npx oh-pi
pi install npm:oh-pi
```

### During migration

Preferred:

```bash
npx pi-agent-colony
pi install npm:pi-agent-colony
```

Legacy-compatible:

```bash
npx oh-pi
pi install npm:oh-pi
```

### After migration window

Canonical only in docs:

```bash
npx pi-agent-colony
pi install npm:pi-agent-colony
```

---

## Recommended announcement framing

> Agent Colony is moving from the legacy bootstrap name `oh-pi` to the canonical package/repository name `pi-agent-colony`. Existing users keep a compatibility path during the transition.

---

## Exit criteria

The rename transition is considered complete when:
- canonical package is published
- repo rename is live
- docs default to `pi-agent-colony`
- users have a clear migration path
- `oh-pi` is no longer the primary public identifier
