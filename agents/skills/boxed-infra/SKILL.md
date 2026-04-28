---
name: boxed-infra
description: Understand Natwest Boxed infrastructure. Use when user asks about devlopment, staging, production, tools, sandbox, kubernetes, datadog
---

## Kubernetes

Use the `kubernetes` tools if available. Fall back to `kubectl`.

Kubernetes clusters are named: `<environment>-<cloud>`

Clouds are `aws` and `gcp`. Default to `aws` when unclear.

Main environments are:

- development: `dev`
- staging: `stg`
- production: `prd`
- client: `client`

- sandbox: `sbx` (used as staging for `tools`)
- tools: `tools` (for internal tools)
