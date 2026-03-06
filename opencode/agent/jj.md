---
# Only used by /clean-history command
description: Do not use
mode: subagent
model: github-copilot/claude-sonnet-4.6
permission:
  "*": allow
  bash:
    "*": ask
    jj*: allow
    jj-hunk*: allow
    gh*: ask
  edit: deny
  todoread: deny
  todowrite: deny
---
