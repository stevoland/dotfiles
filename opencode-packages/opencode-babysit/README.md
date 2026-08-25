# opencode-babysit

An OpenCode V2 server plugin that starts a dedicated `babysitter` agent session
for a GitHub pull request. It provides both `/babysit` and a model-callable
`babysit` tool. Its `/tui` entrypoint opens each started babysitter session in a
tab and focuses it through a typed RPC event.

The plugin verifies explicit PR numbers and URLs with GitHub CLI. When input is
missing or invalid, it asks `github-copilot/gpt-5.6-luna` with the `high` variant
to infer a URL from the calling session. Tool results and reasoning are omitted
from that inference prompt; tool names and inputs are retained.

## Install

```sh
opencode2 plugin add opencode-babysit
```

The `gh` executable must be installed and authenticated. OpenCode must provide a
`babysitter` agent with permission to use the `babysit` and `review-amends`
skills.

## Usage

```text
/babysit 42
/babysit https://github.com/acme/widgets/pull/42
```

Models can call the `babysit` tool with an optional `pullRequest` string. If the
argument is omitted, the plugin infers the PR from the calling session.
The starter tool is hidden from the `babysitter` agent and from child sessions,
preventing agents from recursively creating more babysitter sessions.

The resulting session is created in the caller's location and titled
`<repo-name>/<pr-number>: Babysitting`.

## Development

```sh
bun install
bun test
bun run typecheck
```
