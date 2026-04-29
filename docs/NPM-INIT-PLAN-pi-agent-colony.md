# npm Initialization Plan for `pi-agent-colony`

## Goal

Create the canonical npm package:

- **`pi-agent-colony`**

while preserving `oh-pi` as a compatibility/transition package.

## Package strategy

### Canonical package
- package name: `pi-agent-colony`
- public product branding: Agent Colony / Agent Colony for Pi
- purpose: the primary install path going forward

### Compatibility package
- package name: `oh-pi`
- purpose: transition/bootstrap compatibility bridge
- responsibility: continue to work, but point users toward `pi-agent-colony`

## Initial publish options

### Option 1 — duplicate package contents initially

Publish `pi-agent-colony` with effectively the same package contents as `oh-pi` for the first migration release.

Pros:
- lowest migration risk
- easiest user story
- same behavior under both names initially

Cons:
- two package names temporarily ship the same product

### Option 2 — thin bridge package later

After canonical adoption is established, reduce `oh-pi` into a thinner legacy bridge.

Pros:
- cleaner long-term separation

Cons:
- not ideal as the first migration step

## Recommended sequence

1. publish `pi-agent-colony` first with equivalent functionality
2. update docs to prefer `pi-agent-colony`
3. keep `oh-pi` operational during migration window
4. later decide whether `oh-pi` should become thinner or deprecated

## Initial metadata recommendations

### `pi-agent-colony` package.json direction
- `name`: `pi-agent-colony`
- `description`: Agent Colony for Pi — bootstrap and package distribution for a multi-agent Pi plugin for complex coding tasks.
- keywords should include:
  - `agent-colony`
  - `pi-coding-agent`
  - `multi-agent`
  - `plugin`
  - `pi-agent-colony`

## Compatibility messaging for `oh-pi`

When migration begins, `oh-pi` should clearly say:

- this is the legacy/transition package name
- the canonical package is now `pi-agent-colony`
- old commands still work during the compatibility window

## Publish checklist

- [ ] Verify `pi-agent-colony` is available on npm
- [ ] Prepare package metadata
- [ ] Run `npm test`
- [ ] Run `npm run build`
- [ ] Run `npm pack`
- [ ] Publish `pi-agent-colony`
- [ ] Tag release notes for migration
- [ ] Update README install commands to prefer canonical package

## Compatibility window recommendation

Keep both package names working for at least one clearly documented release cycle before considering de-emphasizing `oh-pi` more aggressively.
