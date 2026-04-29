# Renaming Plan: `oh-pi` → `pi-agent-colony`

## Why this needs to happen

A public issue already shows real user confusion between this repository/package and another project named `oh-pi`.

That means the naming collision is no longer theoretical. It now affects:

- user trust
- install choice
- search clarity
- product positioning

The current product direction is already colony-first:

- **Ant Colony for Pi** = primary product
- `oh-pi` = current bootstrap / distribution name

The naming should eventually match that reality.

---

## Goals

1. Make the primary public name unambiguous
2. Preserve a safe migration path for existing users
3. Reduce confusion between this project and the other `oh-pi`
4. Keep install disruption low during the transition

---

## Recommended migration strategy

### Phase 1 — Immediate clarification

Do now:

- Keep the current package and repo operational
- Make **Ant Colony for Pi** the dominant public name everywhere
- Explicitly say this repo is **not affiliated with / not a fork of** the other `oh-pi`
- Answer the public issue clearly

This phase is low-risk and should happen first.

### Phase 2 — Canonical rename decision

Choose a canonical new name for repo + npm package.

Selected direction:

- **Brand / product name:** `Agent Colony`
- **Formal product subtitle:** `Agent Colony for Pi`
- **Repo:** `pi-agent-colony`
- **npm package:** `pi-agent-colony`

Why this is the current recommendation:

- more productized than `oh-pi`
- more specific and less collision-prone than plain `agent-colony`
- keeps the Pi association explicit at install/search time
- gives the project a clean canonical identifier for GitHub and npm

### Phase 3 — Transition release

If a new npm package is created:

- publish the new canonical package
- keep `oh-pi` as a transition package for a period
- update `oh-pi` README and postinstall messaging to point users to the new canonical package
- mark `oh-pi` as legacy/bootstrap naming, not the long-term product name

### Phase 4 — Deprecation path

After a transition window:

- de-emphasize `oh-pi` in README, release notes, and docs
- optionally deprecate the old npm package name with guidance
- keep compatibility only as long as it helps migration

---

## What should change

### GitHub

- repository name
- repository description
- social preview / tagline
- release titles

### npm

- canonical package name
- package description
- keywords
- deprecation notice on legacy package if needed

### Docs

- README top section
- install instructions
- changelog / migration note
- extension README
- product docs

---

## Suggested public wording

### Short form

> Agent Colony is the primary product. `oh-pi` is the current bootstrap / legacy package name during transition.

### Clarification form

> This project is not a fork of the other `oh-pi`. It is a separate project being re-centered around Agent Colony for Pi.

---

## Decision to make next

Choose one:

### Option A — soft rename first

- keep repo/package names for now
- switch all branding to Agent Colony / Agent Colony for Pi
- defer actual package rename

**Pros:** low risk
**Cons:** confusion continues at install/search level

### Option B — full rename path

- rename repo
- publish new npm package
- keep old package as compatibility bridge

**Pros:** resolves confusion at the root
**Cons:** requires migration work

---

## Recommendation

Choose **Option B** soon, but complete **Phase 1** immediately.

In other words:

- clarify now
- rename deliberately
- keep compatibility during migration
