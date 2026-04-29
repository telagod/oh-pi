# Install / Migration Matrix

This matrix defines how users should install and talk about the project during the rename transition from `oh-pi` to `pi-agent-colony`.

## Naming model

| Layer | Current | Target |
|------|---------|--------|
| Brand | Agent Colony | Agent Colony |
| Formal product name | Agent Colony for Pi | Agent Colony for Pi |
| Legacy/bootstrap package name | `oh-pi` | transition only |
| Canonical future repo/package | not yet live | `pi-agent-colony` |

---

## Install matrix

### Phase 0 — today

| User intent | Install command | Notes |
|------------|-----------------|-------|
| Guided bootstrap install | `npx oh-pi` | Current working path |
| Pi package install | `pi install npm:oh-pi` | Current package path |
| Talk about the product | “Agent Colony” / “Agent Colony for Pi” | Prefer product name over package name |

### Phase 1 — canonical package published

| User intent | Preferred command | Legacy-compatible command | Notes |
|------------|-------------------|---------------------------|-------|
| Guided/bootstrap install | `npx pi-agent-colony` | `npx oh-pi` | Old command remains during transition |
| Pi package install | `pi install npm:pi-agent-colony` | `pi install npm:oh-pi` | Prefer canonical name in docs |
| Repo reference | `github.com/telagod/pi-agent-colony` | old repo URL redirects | GitHub rename should preserve redirects |

### Phase 2 — migration window active

| Surface | What docs should show | What still works |
|--------|------------------------|------------------|
| README | `pi-agent-colony` first | `oh-pi` listed as legacy/transition path |
| Release notes | rename notice + migration path | old package name still accepted |
| npm metadata | canonical package emphasized | legacy package points forward |

### Phase 3 — post-transition

| Surface | Canonical | Legacy |
|--------|-----------|--------|
| Repo | `pi-agent-colony` | redirect only |
| npm install docs | `pi-agent-colony` | legacy package de-emphasized or deprecated |
| Public naming | Agent Colony / Agent Colony for Pi | `oh-pi` no longer primary |

---

## Recommended user-facing wording

### Short version

> Use **Agent Colony** as the product name. Use `pi-agent-colony` as the canonical repo/package name once published. `oh-pi` is the transition name.

### Migration version

> The project is moving from the legacy bootstrap name `oh-pi` to the canonical package/repo name `pi-agent-colony`. Existing users should still have a compatibility path during the migration window.

---

## FAQ summary

| Question | Answer |
|---------|--------|
| Is `oh-pi` going away immediately? | No |
| Should new docs prefer `pi-agent-colony`? | Yes, once published |
| Should the product still be called Agent Colony? | Yes |
| Should old commands keep working for a while? | Yes |
