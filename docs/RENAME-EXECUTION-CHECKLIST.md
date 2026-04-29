# Rename Execution Checklist

This checklist is the concrete execution path for moving from the legacy/bootstrap name `oh-pi` to the canonical repo/package name **`pi-agent-colony`** and the public product name **Agent Colony**.

## Phase A — public-name unification

- [x] README headline switched to **Ant Colony for Pi**
- [x] Clarified that this project is not a fork of the other `oh-pi`
- [x] Explained that `oh-pi` is a transition/bootstrap/package name
- [x] Replied publicly on the confusing-name GitHub issue
- [x] Added rename strategy doc

## Phase B — canonical rename preparation

### Decision
- [x] Finalize canonical repo name → `pi-agent-colony`
- [x] Finalize canonical npm package name → `pi-agent-colony`
- [ ] Decide whether to keep unscoped package, scoped package, or both

### GitHub rename
- [ ] Rename repository
- [ ] Update repository description
- [ ] Update About/website/social preview text
- [ ] Add redirect/migration note in old references if needed

### npm migration
- [ ] Create/publish canonical new package name
- [ ] Keep `oh-pi` as compatibility bridge package during transition
- [ ] Add deprecation/migration message to legacy package if needed
- [x] Document install matrix: old name vs new canonical name

### Docs and UX
- [ ] Update install commands in README
- [ ] Update badges if package name changes
- [x] Update release sequencing / migration release plan
- [x] Add migration FAQ
- [ ] Update screenshots / examples / issue templates if they mention old naming

### Release sequencing
- [ ] Publish canonical package first
- [ ] Tag a migration release on GitHub
- [ ] Announce rename in release notes
- [ ] Keep compatibility window open for a defined period

## Selected naming direction

- **brand:** `Agent Colony`
- **formal product name:** `Agent Colony for Pi`
- **repo:** `pi-agent-colony`
- **npm package:** `pi-agent-colony`

## Other viable options considered

- `agent-colony`
- `agent-colony-for-pi`
- `pi-ant-colony`
- `@telagod/ant-colony`
- `@telagod/ant-colony-pi`

## Recommendation

Use this order:

1. finish public clarification
2. rename repo/package to `pi-agent-colony`
3. publish canonical package
4. keep `oh-pi` as migration bridge
5. eventually de-emphasize legacy name everywhere
