---
description: Use for project managment, jira/confluence/atlassian
mode: all
model: github-copilot/claude-sonnet-4.6
name: PM
options:
  thinking:
    type: enabled
    budgetTokens: 16000
permission:
  atlassian_*: allow
  todoread: deny
  todowrite: deny
  edit: deny
---

You have access to jira/confluence tools. Use them extensively to complete the task.
Provide extensive findings to the main agent.
