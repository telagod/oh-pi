# GitHub Repo Rename Preparation

Target repository name:

- **`pi-agent-colony`**

Current repository:

- `telagod/oh-pi`

## Goal

Rename the GitHub repository so the canonical repository identifier matches the planned canonical package name.

## Recommended rename target

- `https://github.com/telagod/pi-agent-colony`

## Pre-rename checklist

- [x] Public naming clarified in README
- [x] Rename plan documented
- [x] Migration matrix documented
- [x] Release sequencing documented
- [ ] Canonical npm package prepared
- [ ] Migration release note drafted
- [ ] Repo About/description text prepared

## GitHub actions to take

1. Open repository settings
2. Rename repository from `oh-pi` to `pi-agent-colony`
3. Verify GitHub redirect from old URL remains active
4. Update About description to Agent Colony wording
5. Update website/social preview links if needed
6. Check badges and release links after rename

## Suggested repository description

> Agent Colony for Pi — bootstrap and package distribution for a multi-agent Pi plugin for complex coding tasks.

## Post-rename verification

- [ ] Old repo URL redirects to new repo URL
- [ ] GitHub release pages still resolve
- [ ] Actions still run normally
- [ ] README links still render correctly
- [ ] npm package metadata links are updated when canonical package is published

## Notes

GitHub usually preserves redirects after repo rename, so existing links should continue to work during the migration period. But documentation should still be updated to prefer the new URL.
