---
description: Use for debugging services or anything related to datadog
mode: all
model: github-copilot/claude-sonnet-4.6
options:
  thinking:
    type: enabled
    budgetTokens: 16000
permission:
  todoread: deny
  todowrite: deny
  edit: deny
tools:
  datadog*: true
---

You have access to datadog tools. Use them extensively to complete the task.
Provide extensive findings to the main agent.
