# opencode-trajectory plan

## Goal

Build an OpenCode V2 CLI plugin that opens a full-screen trajectory viewer for the current session when the user runs `/trajectory`.

The viewer will present the session as a chronological execution trace: user input, system and instruction updates, model steps, reasoning, tool calls, retries, compactions, results, errors, and timing.

This is an independent package under `opencode-packages/opencode-trajectory`. It must not depend on BoxedCode.

## Reference experience

The interaction model and visual hierarchy should be based on the **Trajectory** tab in the local dsh web application at `http://127.0.0.1:3080/`. Inspect it with `agent-browser` before implementing or materially changing the TUI.

dsh web requires the current `?token=...` URL printed when the server starts. Use that URL at runtime, but never copy the authentication token into this repository, fixtures, screenshots, logs, or test artifacts.

The TUI should adapt the reference experience to terminal constraints rather than copying browser-specific controls literally. Preserve these defining features:

- a chronological trace grouped into turns;
- a compact Input, Model, and Tools timeline;
- visibly distinct system, context, user, assistant, and tool rows;
- selection shared between the timeline and event list;
- a detail inspector with Summary, Payload, Result, Schema, and Timing sections when that data exists;
- search across the trajectory;
- clear running, completed, failed, and interrupted states.

## User experience

Running `/trajectory` from a session opens a full-screen `session.panel`. `Escape` returns to the session without adding a message to the conversation.

The wide layout has three areas:

1. A summary and scaled timeline across the top.
2. A chronological event list on the left.
3. Details for the selected event on the right.

Narrow terminals show the event list first and open details as a separate view.

Initial controls:

- `j`/`k` and arrow keys select an event.
- `Enter` opens or focuses event details.
- `Tab` and `Shift+Tab` move between detail sections.
- `/` searches visible trajectory content.
- `Escape` closes details, then closes the viewer.

## Available session data

The first version can use existing OpenCode APIs without changing OpenCode itself.

### Session messages

Paginate `context.client.message.list()` to obtain the complete projected history. Messages provide:

- user input;
- persisted system and instruction updates;
- assistant text and reasoning;
- tool names, IDs, input, output, errors, and status;
- model, agent, finish reason, token usage, and cost;
- message and tool timestamps;
- compactions, skills, shell commands, and session changes.

The public reactive message cache is useful for updates but does not expose loading older pages, so it must not be the only history source.

### Durable session events

Replay `context.client.session.log({ sessionID, follow: false })` to obtain execution structure and deterministic ordering. The durable log provides:

- execution start, success, failure, and interruption;
- model step boundaries;
- text and reasoning boundaries;
- tool input, call, success, and failure events;
- retries;
- durable sequence numbers and timestamps.

Use durable sequence for ordering. Use timestamps only for displayed times and durations.

Subscribe through `context.data.listen()` while the viewer is mounted so running sessions update live. Deduplicate durable events by event ID or durable sequence.

### Data not currently persisted

An existing session does not contain the exact provider request for every model step. In particular, it does not preserve:

- the complete generated system prompt;
- the exact model-facing context after all transformations;
- the tool descriptions and JSON schemas supplied to that request;
- generation and provider option overrides;
- ephemeral tool progress and streaming deltas after they have passed.

Do not reconstruct these values and present them as exact. The first version will omit unavailable detail sections.

If exact request inspection becomes a requirement, add an opt-in server plugin that captures the `session.context` hook and exposes snapshots to the TUI through plugin RPC. That capability is a later product decision because it duplicates potentially sensitive prompts and can consume significant storage.

## Package shape

The intended package layout is:

```text
opencode-packages/opencode-trajectory/
├── package.json
├── README.md
├── tsconfig.json
├── src/
│   ├── trajectory-data.ts
│   ├── trajectory-data.test.ts
│   ├── trajectory-duration.ts
│   └── trajectory-duration.test.ts
├── test/
│   └── scenarios/
│       ├── trajectory-basic.ts
│       ├── trajectory-tools.ts
│       ├── trajectory-failures.ts
│       ├── trajectory-live.ts
│       └── trajectory-responsive.ts
└── tui/
    ├── trajectory-tui.tsx
    ├── trajectory-panel.tsx
    ├── trajectory-event-list.tsx
    ├── trajectory-event-details.tsx
    └── trajectory-timeline.tsx
```

The package will expose `./tui` for OpenCode CLI plugin loading. A server-plugin entrypoint should only be added if exact context capture is approved.

## View model

Keep OpenCode API decoding separate from rendering. `trajectory-data.ts` will fold messages and durable events into a discriminated union such as:

```ts
type TrajectoryViewModel = {
  sessionID: string
  title: string
  status: "idle" | "running" | "failed" | "interrupted"
  startedAt?: number
  completedAt?: number
  durationMs?: number
  summary: TrajectorySummary
  lanes: TrajectoryLane[]
  turns: TrajectoryTurn[]
  itemsByID: ReadonlyMap<string, TrajectoryItem>
}

type TrajectorySummary = {
  turnCount: number
  stepCount: number
  toolCallCount: number
  failedToolCallCount: number
  inputTokens?: number
  outputTokens?: number
  cost?: number
}

type TrajectoryLane = {
  type: "input" | "model" | "tools"
  intervals: TrajectoryInterval[]
}

type TrajectoryInterval = {
  itemID: string
  startedAt: number
  completedAt?: number
  status: "running" | "completed" | "failed" | "interrupted"
}

type TrajectoryTurn = {
  number: number
  userItemID?: string
  executionItemID?: string
  itemIDs: string[]
  startedAt: number
  completedAt?: number
}

type TrajectoryItem =
  | TrajectorySystemItem
  | TrajectoryContextItem
  | TrajectoryUserItem
  | TrajectoryAssistantItem
  | TrajectoryReasoningItem
  | TrajectoryToolItem
  | TrajectoryRetryItem
  | TrajectoryCompactionItem
```

Every item will share this searchable base shape:

```ts
type TrajectoryItemBase = {
  id: string
  type: string
  sequence: number
  turn?: number
  step?: number
  status: "running" | "completed" | "failed" | "interrupted"
  startedAt: number
  completedAt?: number
  durationMs?: number
  summary: string
  searchableText: string
}
```

Type-specific data will remain structured rather than being flattened into display strings:

- system/context: text, description, and provenance when available;
- user: text, files, agents, and skills;
- assistant: text, model, agent, finish reason, tokens, cost, and error;
- reasoning: text and timing;
- tool: call ID, tool name, parsed or streaming input, output content, error, metadata, execution source, and provider state;
- retry: attempt, scheduled time, and error;
- compaction: reason, status, summary, recent context, and model.

The selected item derives a `TrajectoryDetailViewModel` with available sections:

```ts
type TrajectoryDetailSection =
  | { type: "summary"; fields: TrajectoryDetailField[] }
  | { type: "payload"; value: unknown }
  | { type: "result"; value: unknown }
  | { type: "schema"; value: unknown }
  | { type: "timing"; fields: TrajectoryDetailField[] }

type TrajectoryDetailViewModel = {
  heading: string
  turn?: number
  step?: number
  sections: TrajectoryDetailSection[]
}
```

Only include sections backed by real data. In particular, do not display a Schema section for historical tool calls unless exact context capture has been implemented.

The fold must tolerate incomplete executions. Running tools and interrupted model steps are normal states, not malformed data.

## Proposed layout

Wide terminals use a synchronized timeline, event list, and inspector:

```text
 trajectory  Session title                         1m 42s · 4 turns · 9 calls
──────────────────────────────────────────────────────────────────────────────
 Input   ━━━ ━━━━━                 ━━━                         ━━━
 Model             ━━━      ━━━         ━━━              ━━━
 Tools                  ━━ ━━ ━━━━━         ━━ ━━ ━━ ━━━━━
──────────────────────────────────────┬───────────────────────────────────────
 Turn 1                               │ TOOL · Turn 4 · Step 2
 SYSTEM     Initial instructions      │
 USER       what plugins are here?    │ Summary  Payload  Result  Timing
 ASSISTANT  Inspecting files...       │ ─────────────────────────────────────
 TOOL       glob {...} → 12 matches   │ Status    completed
 TOOL       read {...} → 144 lines    │ Tool      read
                                      │ Duration  46 ms
 Turn 2                               │
 USER       ...                       │ Payload
 ASSISTANT  ...                       │ {
>TOOL       read {...} → ...          │   "file_path": "…"
                                      │ }
──────────────────────────────────────┴───────────────────────────────────────
 ↑↓/jk select   enter inspect   / search   tab section   esc close
```

Layout rules:

- The header always shows session status, duration, turn count, and tool-call count.
- Timeline intervals use semantic theme colours and remain at least one cell wide.
- The selected event is highlighted in both the timeline and list.
- Turn labels remain visible while scrolling their events where OpenTUI permits it.
- Rows show one-line summaries; full values belong in the inspector.
- Payload and result values use readable JSON or text rendering with vertical scrolling.
- Unavailable sections are omitted, not disabled placeholders.
- On medium-width terminals, the inspector opens over the list.
- On narrow terminals, the timeline collapses to summary counts and the list becomes full width.
- Mouse interaction is optional; every action must work from the keyboard.

## Duration rules

- Session duration: first displayed event to the latest completed event or the current time while running.
- Execution duration: `session.execution.started` to its terminal execution event.
- Model duration: step start to step end or failure.
- Tool duration: `completed - (ran ?? created)`.
- Reasoning duration: reasoning completion minus reasoning creation.
- Missing terminal timestamps display as running rather than `0 ms`.

Duration calculations belong in pure functions so they can be tested independently of the TUI.

## Delivery slices

### Slice 1: working vertical path

- Scaffold the independent package.
- Register the `/trajectory` slash and palette command.
- Open a full-screen panel for the current session.
- Paginate all session messages.
- Render chronological user, assistant, reasoning, and tool rows.
- Show selected tool payload, result, status, and duration.
- Handle loading, empty, and failed states.

Acceptance criteria:

- `/trajectory` never sends a prompt to the model.
- It opens only when a session is active.
- A historical tool call can be selected and inspected.
- `Escape` returns to the originating session.

### Slice 2: execution structure

- Replay the durable session log.
- Group rows into turns and model steps.
- Show execution, model, and tool durations.
- Represent retries, failures, interruptions, and compactions.
- Merge projected message content with event chronology without duplicate rows.

Acceptance criteria:

- Parallel tool calls remain distinct by tool call ID.
- Durable sequence determines stable ordering after reopening the viewer.
- An incomplete live execution renders without throwing.

### Slice 3: trajectory timeline

- Add Input, Model, and Tools lanes.
- Scale event intervals to the available terminal width.
- Highlight the selected interval and keep list selection synchronized.
- Add horizontal navigation only if scaling is unusable for long sessions.

Acceptance criteria:

- Zero-duration and overlapping events remain visible.
- Resizing does not lose selection or corrupt the layout.
- Narrow terminals fall back to the list-first layout.

### Slice 4: live updates and search

- Fold live events while the panel is open.
- Indicate when unseen events arrive after the user scrolls away.
- Search summaries, message text, tool names, input, output, and errors.
- Keep search local; it must not issue a model request.

### Slice 5: exact request capture, if approved

- Add a server plugin entrypoint.
- Capture the final `session.context` hook value for each model dispatch.
- Persist snapshots with an explicit retention policy.
- Expose snapshots through typed plugin RPC.
- Add exact System, Context, Schema, and Generation detail sections.

This slice is not required for the initial trajectory viewer.

## Testing

### Unit tests

Use fixtures for:

- a simple user/assistant exchange;
- one and multiple tool calls;
- parallel tool calls;
- tool success and failure;
- retries;
- interrupted and still-running executions;
- reasoning segments;
- compaction boundaries;
- paginated message history;
- duplicate durable/live events;
- missing optional timestamps.

Test event folding, grouping, ordering, duration calculation, and search as pure functions.

### OpenCode Drive scenarios

Create deterministic black-box scenarios using the published `opencode-drive` npm package. Use `/Users/stephen.collings/workspace/github.com/anomalyco/opencode-drive` only as reference source when learning its APIs and established scenario patterns. The scenarios belong to this package under `test/scenarios`; do not add trajectory-specific code to the Drive repository.

Use `OpenCodeDriver.use`, scripted `Llm` responses, UI assertions, and screenshots to cover:

- basic user and assistant exchange;
- reasoning followed by a final answer;
- sequential and parallel successful tool calls;
- tool failure with partial output;
- provider retry followed by success;
- interrupted model and running-tool states;
- compaction and post-compaction history;
- enough messages to exercise API pagination;
- live updates while `/trajectory` remains open;
- selection synchronization between list and timeline;
- payload, result, and timing detail navigation;
- search and clearing search;
- wide, medium, and narrow terminal layouts;
- resize while an item is selected;
- closing the viewer back to the originating session.

Each scenario should use a deterministic simulated model rather than a real provider. Capture terminal screenshots for meaningful checkpoints and keep artifacts beneath a package-local, ignored `.drive-output` directory by setting `OPENCODE_DRIVE_MEDIA_DIR`.

Use Drive server admissions as the ground truth for verifying that `/trajectory` did not send a prompt. A successful command scenario must prove that opening, interacting with, and closing the viewer creates no additional user admission.

### Manual TUI verification

Use terminal-control against a development OpenCode session to verify:

- command registration;
- full-screen open and close;
- keyboard navigation and focus;
- wide and narrow layouts;
- live updates while a tool is running;
- terminal resize behaviour;
- light and dark theme readability.

## Explicit non-goals for the first release

- Editing or replaying session events.
- Sending prompts or running tools from the viewer.
- Reconstructing unavailable system prompts or tool schemas.
- Supporting OpenCode V1.
- Depending on BoxedCode or modifying its TUI plugin.
- Persisting a second copy of ordinary session history.

## Reference implementation points

Useful OpenCode V2 source locations:

- `packages/tui/src/feature-plugins/system/stats.tsx` — slash command and custom screen pattern.
- `packages/plugin/src/tui/context.ts` — TUI plugin, panel, route, keymap, and data APIs.
- `packages/schema/src/session-message.ts` — projected message and tool-state schemas.
- `packages/schema/src/session-event.ts` — durable execution event schemas.
- `packages/core/src/session/model-request.ts` — final model context and context-hook invocation.
- `packages/core/src/session/stats.ts` — existing tool-duration calculation.
- `packages/protocol/src/groups/message.ts` — paginated message API.
- `packages/protocol/src/groups/session.ts` — session context and durable log APIs.

## Definition of done

The initial release is complete when the package can be installed as an OpenCode V2 CLI plugin, `/trajectory` opens a responsive viewer for the active session, all persisted history is represented in deterministic order, tool payloads and results are inspectable, durations are correct, live executions update safely, and unavailable provider-request data is clearly omitted rather than guessed.
