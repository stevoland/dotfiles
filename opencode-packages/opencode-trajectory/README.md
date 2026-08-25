# opencode-trajectory

An OpenCode V2 CLI plugin for inspecting the current session as a chronological execution trajectory.

It provides:

- the `/trajectory` slash command;
- Input, Model, and Tools timeline lanes;
- turn-grouped user, assistant, reasoning, context, and tool rows;
- tool payload, result, status, and timing inspection;
- local search without sending a model request;
- responsive full-screen terminal layouts.

## Install

Add the package to the `plugins` array in your OpenCode V2 `cli.json`:

```json
{
  "plugins": ["opencode-trajectory"]
}
```

For local development, use the absolute path to this package instead.

Open a session and run:

```text
/trajectory
```

## Limitations

OpenCode does not persist the exact system prompt, transformed model context, or tool JSON schemas used for each historical model request. The viewer omits unavailable detail sections rather than reconstructing them and presenting them as exact.

## Develop

```sh
bun install
bun test
bun run typecheck
```

The deterministic TUI scenario uses the published `opencode-drive` package. The checkout at `/Users/stephen.collings/workspace/github.com/anomalyco/opencode-drive` is reference source only:

```sh
OPENCODE_DRIVE_MEDIA_DIR="$PWD/.drive-output" bun run test:scenario
```

See [`plan.md`](plan.md) for the design and staged delivery plan.
