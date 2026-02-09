---
description: Ask for questions related to debugging services is kubernetes, datadog, jira, confluence
mode: primary
model: github-copilot/gpt-5.2-codex
options:
  reasoningEffort: medium
  reasoningSummary: auto
  include:
    - reasoning.encrypted_content
permission:
  todoread: deny
  todowrite: deny
  edit: deny
tools:
  batch: false
  atlassian*: true
  datadog*: true
---
