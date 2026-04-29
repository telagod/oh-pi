# Migration Announcement: `oh-pi` → `pi-agent-colony`

## Short version

**Agent Colony** now has a canonical repository and package name:

- **GitHub repo:** `telagod/pi-agent-colony`
- **npm package:** `pi-agent-colony`

The old name **`oh-pi`** remains available during the transition window as a compatibility/legacy bootstrap name.

---

## What changed

The project has been re-centered around **Agent Colony** / **Agent Colony for Pi**.

To reduce confusion with another project also named `oh-pi`, the canonical identifiers are now:

- `pi-agent-colony` for GitHub
- `pi-agent-colony` for npm

---

## Recommended install commands

### Canonical install path

```bash
npx pi-agent-colony
pi install npm:pi-agent-colony
```

### Legacy-compatible path

```bash
npx oh-pi
pi install npm:oh-pi
```

Use the canonical name for new documentation, new installs, and future references.

---

## Compatibility promise

Existing `oh-pi` users are **not** expected to break immediately.

During the migration window:
- `oh-pi` continues to exist as a compatibility path
- `pi-agent-colony` is the canonical package/repo name
- the public product name is **Agent Colony**

---

## Suggested announcement text

### English

> Agent Colony is moving from the legacy bootstrap name `oh-pi` to the canonical package/repository name `pi-agent-colony`.
> 
> New installs should prefer:
> - `npx pi-agent-colony`
> - `pi install npm:pi-agent-colony`
> 
> Existing `oh-pi` users still have a compatibility path during the migration window.

### 中文

> Agent Colony 现已从历史 bootstrap 名称 `oh-pi` 迁移到新的 canonical 仓库/包名 `pi-agent-colony`。
> 
> 新安装建议优先使用：
> - `npx pi-agent-colony`
> - `pi install npm:pi-agent-colony`
> 
> 现有 `oh-pi` 用户在迁移窗口内仍保留兼容路径。

---

## Current status

- canonical repo rename: done
- canonical npm package publish: done
- legacy package compatibility: still active
