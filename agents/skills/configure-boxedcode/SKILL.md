---
name: configure-boxedcode
description: Use when packaging or loading BoxedCode/OpenCode plugins from GitHub, or when the BoxedCode sandbox prevents legitimate operations.
---

Defer to the `OpenCode` skill for all `BoxedCode` v2 configuration.

## GitHub plugin loading

When packaging or loading a plugin from GitHub, read [GitHub plugin loading](references/github-plugin-loading.md) for source exports, Git preparation traps, installation and updates.

## Configure sandbox (box.json)

Sandbox user config file: `~/.nwb/box/box.json`. It is merged with the [base config](https://github.com/eeveebank/box/blob/master/src/box.json).

The settings are read per tool call - no need to restart after edits.

The user can temporarily disable the sandbox for `write`, `read`, `webfetch` and `shell` for all sessions from the BoxeddCode TUI sidebar.

### Network config

- `network.allowedDomains` (array, supports subdomain wildcards `*.example.com`).
- `network.deniedDomains` (array, checked first).

### Filesystem config

Read:

- `filesystem.denyRead` (array).

Write:

- `filesystem.allowWrite` (array).
- `filesystem.denyWrite` (array, takes precedence).

Path syntax:

- macOS: git-style globs (`*`, `**`, `?`, `[abc]`).
- All: absolute or relative; `~` expands to home.

### git push

The sandbox prevents auth with git remotes via ssh. Use https remotes with the `gh` cli credential helper.

`gh auth setup-git` (one time)

The user can remap any ssh remote-urls to https in via global git config:

```
# ~/.gitconfig
[url "https://github.com/eeveebank/"]
    insteadOf = "git@github.com:eeveebank/"
```

You cannot edit this file directly from the sandbox.
