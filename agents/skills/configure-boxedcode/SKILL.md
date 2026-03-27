---
name: configure-boxedcode
description: Configure BoxedCode/OpenCode. Use when creating/customising agents, or when the sandbox prevents operations the user says are legitimate.
---

# Configure BoxedCode

Configure BoxedCode/OpenCode agents with markdown files. Use when creating/customising agents, or when the sandbox prevents operations the user says are legitimate.

## About BoxedCode

BoxedCode is a simple wrapper around [OpenCode](https://opencode.ai/docs). It provides default config for our available provider/models and lightweight filesystem/network sandboxing to make OpenCode’s tools safer.

## Create + customise agents (markdown)

`boxedcode` writes config to `~/.config/opencode/opencode.json`. Don't edit this file to create agents; instead, create markdown files.

### 1) Choose scope + location

- Project scope: `.opencode/agent/`
- Global scope: `~/.config/opencode/agent/`

The [sandbox](https://github.com/eeveebank/box) prevents you from writing to these locations directly. Present the content to the user and ask them to create files with the content you generate.

### 2) Create an agent markdown file

- File name becomes the agent name (example: `review.md` → `review` agent).
- Use YAML frontmatter at top; put prompt content after.
- Prompts override the default system prompt for that agent.
- Frontmatter options are merged with defaults; only specify what you want to change.

Minimal template:

```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: github-copilot/claude-sonnet-4.6
temperature: 0.1
tools:
  write: false
  edit: false
  bash: false
---

Focus on:

- Code quality
- Potential bugs
- Performance
- Security

Provide feedback only; do not edit files.
```

### 3) Customize frontmatter options

- `description` (required): short, concrete use-case
- `mode`: `primary`, `subagent`, or `all`
- `model`: github-copilot/model-id
- `temperature`: 0.0–1.0
- `tools`: coarse on/off switches for built-in tools (for example `write`, `edit`, `bash`)
- `permission`: fine-grained allow/ask/deny rules per tool or per bash/skill pattern; combines with `tools`

`bash: allow` and `bash."*": allow` are disallowed and overridden by boxedcode to `bash."*": ask`.

Example with permissions:

```markdown
---
description: Read-only reviewer
mode: subagent
permission:
  edit: deny
  bash:
    "*": ask
    "git diff": allow
    "git log*": allow
---

Only analyze and suggest changes.
```

### 4) Verify

- Quit boxedcode and `boxedcode --continue` to reload config.
- `boxedcode debug config` to see final merged config and troubleshoot.
- Invoke subagents directly `@agent-name` or <tab> to primary agent.

## Configure sandbox (box.json)

Sandbox user config file: `~/.nwb/box/box.json`. It is merged with the [base config](https://github.com/eeveebank/box/blob/master/src/box.json).

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
