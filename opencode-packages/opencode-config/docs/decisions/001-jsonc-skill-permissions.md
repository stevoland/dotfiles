# ADR-001: Persist skill toggles as JSONC permission maps

## Status

Accepted

## Context

Skills are resolved by the OpenCode server, while the TUI plugin needs to
offer separate local and global controls. The plugin API exposes the resolved
skill catalog but does not expose a configuration-file update operation for
the two user-selected paths.

## Decision

The plugin reads and updates the local `./.opencode` and global
`~/.config/opencode` OpenCode configuration files directly. It uses
`jsonc-parser` edits so existing JSONC comments and unrelated configuration
remain in place. A disabled skill is represented by a V1
`permission.skill[skillID] = "deny"` entry. An enabled toggle writes the
corresponding `"allow"` entry, which also overrides a wildcard deny rule in
that file. Existing `permission.skill["*"] = "deny"` entries are never
removed. A skill without an exact entry is displayed as indeterminate and
can be returned to that state by removing its exact entry.

## Alternatives considered

### Store toggle state in plugin storage

Rejected because OpenCode's permission evaluator would not see the state, and
the user explicitly needs the settings persisted in both configuration files.

### Rewrite complete JSON files with `JSON.stringify`

Rejected because it would discard comments and make unrelated configuration
changes noisy.

## Consequences

- The plugin can control each scope independently and works with existing JSON
  and JSONC configuration files.
- A config file is created as JSONC when the requested scope has no existing
  config file.
- Direct file edits are intentionally limited to the `permission.skill` map;
  config reload is requested after a successful toggle.
