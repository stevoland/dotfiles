# opencode-config

An OpenCode TUI plugin for managing skill availability from the sidebar. The
Skills button opens a dialog containing every skill discovered in the current
location, its filesystem location, and independent local and global toggles.

The plugin stores skill states in the V1 `permission.skill` map. Disabled
skills are stored as `"<id>": "deny"`; enabled skills are stored as
`"<id>": "allow"`; and skills without an exact entry are shown as
indeterminate (`-`). Local settings are written to `./.opencode/opencode.json` (or the
existing JSONC file), and global settings are written to
`~/.config/opencode/opencode.json` (or the existing JSONC file). JSONC comments
and unrelated configuration are retained, including a global
`permission.skill["*"] = "deny"` rule.

## Install

```sh
opencode2 plugin add opencode-config
```

## Development

```sh
bun install
bun test
bun run typecheck
```

The server entrypoint enables the TUI entrypoint. Sidebar UI lives in
`tui/tui.tsx`; JSONC permission reading and writing lives in
`src/skill-permission-config.ts`.
