---
name: datadog-env-changes
description: Uses Datadog events to surface what has changed in a given environment over a time window. Useful for incident investigation, deployment auditing, and change-cause analysis. Requires the Datadog MCP.
---

# Datadog Environment Changes

Surfaces what has changed in a Datadog-monitored environment by querying the events stream. Useful for incident investigation, deployment audits, and answering "what changed?".

## Usage

```
/datadog-env-changes [env] [timeframe]
```

**Arguments:**
- `env` - Target environment (e.g. `bbp`, `prd`, `client`, `stg`, `dev`, `sbx`). Defaults to `prd`.
- `timeframe` - How far back to look (e.g. `1h`, `4h`, `24h`). Defaults to `1h`.

## Instructions

### 1. Parse Arguments

Extract `env` and `timeframe` from the invocation. Apply defaults:
- `env` → `prd`
- `timeframe` → `1h`

Convert the timeframe to a `from` value in the form `now-<timeframe>` (e.g. `now-1h`).

### 2. Fetch Events in a Single Call

Call `datadog_search_datadog_events` **once** with:

```
query: "env:<env> -source:(containerd OR datadog OR alert OR gatling OR kubernetes OR amazon_cloudtrail) -service:core-platform-feature-tests -reporting_controller:kyverno-admission -reporting_controller:kyverno-scan -reporting_controller:daemonset-controller -reporting_controller:kubelet -reporting_controller:bin-packing-scheduler -reporting_controller:replicaset-controller -reporting_controller:statefulset-controller -reporting_controller:job-controller -reporting_controller:cronjob-controller -(reporting_controller:argocd-application-controller \"Progressing -> Healthy\")"
from:  "now-<timeframe>"
to:    "now"
sort:  "-timestamp"
```

The exclusions strip high-volume Kubernetes reconciliation churn that carries no "what changed" signal:
- `containerd` — container lifecycle create/destroy noise
- `datadog`, `alert` — internal Datadog platform events
- `gatling` — load test noise
- `kubernetes` — raw k8s controller churn (deployments tracked via `change_tracking` instead)
- `amazon_cloudtrail` — high-volume AWS API audit log noise
- `kyverno-admission`, `kyverno-scan` — fires on every resource creation, not changes
- `daemonset-controller`, `kubelet` — scheduling and probe noise
- `bin-packing-scheduler` — node-packing decisions
- `replicaset-controller`, `statefulset-controller`, `job-controller`, `cronjob-controller` — rollout internals and scheduled job lifecycle, redundant with change_tracking
- `argocd-application-controller "Progressing -> Healthy"` — healthy deploy cycling; unhealthy states are kept
- `service:core-platform-feature-tests` — ephemeral `chainsaw-*` test namespaces that generate continuous deployment events with no production signal

Keep `max_tokens` at the default unless you expect very high event volume — this avoids unnecessary overhead.

**Do not** issue multiple exploratory calls. One targeted query is sufficient.

### 3. Categorise the Results

Group events by their `source` or dominant tag signal into these buckets (skip empty buckets):

| Category | Signals to look for |
|---|---|
| **Deployments** | `source:change_tracking` with a deployment title — new version, `identified_changes` tag present |
| **CrashLoopBackOff / pod failures** | `source:change_tracking` with a backoff/restart title — **deduplicate by `pod_name`**: the same pod fires hundreds of events; group by pod, report once with restart count and how long it has been crashing |
| **Watchdog anomalies** | `source:watchdog` — Watchdog Stories for error rate spikes, latency increases, and new log patterns. **Deduplicate by `story_key`** — the same story fires repeatedly; group by `story_key` and report each story once with a repeat count |
| **Database / infrastructure** | `source:amazon_rds` (RDS instance events: failovers, maintenance, restarts), `source:terraform`, `source:crossplane`, Crossplane CRD errors (e.g. `CannotObserveExternalResource`) |
| **Other** | Any remaining source not covered above |

### 4. Present a Concise Summary

Output a short report structured as:

```
## What changed in <env> (last <timeframe>)

### Deployments  (<count>)
- <timestamp> · <service> v<version> · <cluster>/<namespace>

### CrashLoopBackOff / pod failures  (<count> distinct pods)
- <pod_name> — <restart count> restarts since <first seen> · <service> · <team>

### Watchdog anomalies  (<count> distinct stories)
- <service> — <story title> (×<repeat count>)

### Database / infrastructure  (<count>)
- <timestamp> · <source> · <one-line description>

### Other  (<count>)
- <timestamp> · <source> · <one-line description>

---
Total events: <N>  |  Time window: <from> → now
```

Rules:
- List **at most 5 items per category** — if there are more, append "…and N more".
- Timestamps should be human-readable (e.g. `14:32 UTC`).
- If a category is empty, omit it entirely.
- If **no events** were found, say so clearly and suggest widening the time window or checking the environment name.

### 5. Offer Next Steps

After the summary, offer (but do not automatically perform) these follow-up actions:

- Drill into a specific category: "Want details on the 3 deployments?"
- Widen the time window: "No changes found — try `1d`?"
- Cross-reference with monitors: "Want to see any active alerts for this env?"

## Examples

**User**: `/datadog-env-changes staging 4h`

**Expected behaviour**:
> Queries `env:staging` over the last 4 hours, returns a grouped summary of deployments, config changes, and alerts.

**User**: `/datadog-env-changes`

**Expected behaviour**:
> Queries `env:prod` over the last 1 hour with defaults applied.

**User**: `/datadog-env-changes prod 24h` (high-traffic period)

**Expected behaviour**:
> Returns up to 5 items per category with "…and N more" truncation to keep the output readable.

## Notes

- This skill requires the **Datadog MCP** to be configured. If `datadog_search_datadog_events` is unavailable, inform the user.
- Efficiency first: always use a single query. Only issue a follow-up query if the user explicitly requests deeper drill-down.
- If the user does not scope to a specific `env` tag in their Datadog setup, suggest they omit the `env:` filter and use a `host:` or `service:` filter instead.
