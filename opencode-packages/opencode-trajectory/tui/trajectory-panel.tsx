/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { TextAttributes } from "@opentui/core"
import type { Plugin } from "@opencode-ai/plugin/tui"
import type { PanelInput } from "@opencode-ai/plugin/tui/context"
import { createEffect, createMemo, createResource, createSignal, onCleanup, onMount, Show } from "solid-js"

import { buildTrajectoryViewModel, filterTrajectoryItems, type TrajectoryItem } from "../src/trajectory-data.js"
import { formatTrajectoryDuration } from "../src/trajectory-duration.js"
import { fetchAllTrajectoryMessages } from "../src/trajectory-session.js"
import { TrajectoryEventDetails, trajectoryDetailTabs, type TrajectoryDetailTab } from "./trajectory-event-details.js"
import { TrajectoryEventList } from "./trajectory-event-list.js"
import { TrajectoryTimeline } from "./trajectory-timeline.js"

const liveRefreshEvents = new Set([
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.instructions.updated",
  "session.synthetic",
  "session.skill.activated",
  "session.shell.started",
  "session.shell.ended",
  "session.step.started",
  "session.step.streamed",
  "session.step.ended",
  "session.step.failed",
  "session.text.ended",
  "session.reasoning.ended",
  "session.tool.input.ended",
  "session.tool.called",
  "session.tool.success",
  "session.tool.failed",
  "session.retry.scheduled",
  "session.compaction.started",
  "session.compaction.ended",
  "session.compaction.failed",
])

function eventBelongsToSession(event: { readonly data: unknown }, sessionID: string): boolean {
  return typeof event.data === "object" && event.data !== null && "sessionID" in event.data && event.data.sessionID === sessionID
}

function moveSelection(items: readonly TrajectoryItem[], selectedID: string | undefined, delta: number): string | undefined {
  if (items.length === 0) return undefined
  const current = items.findIndex((item) => item.id === selectedID)
  const index = current < 0 ? 0 : Math.max(0, Math.min(items.length - 1, current + delta))
  return items[index]?.id
}

export function TrajectoryPanel(props: { readonly context: Plugin.Context; readonly panel: PanelInput }) {
  const [revision, setRevision] = createSignal(0)
  const [query, setQuery] = createSignal("")
  const [selectedItemID, setSelectedItemID] = createSignal<string>()
  const [detailOpen, setDetailOpen] = createSignal(false)
  const [detailTabIndex, setDetailTabIndex] = createSignal(0)
  let listScroll: ScrollBoxRenderable | undefined

  const [trajectory, { refetch }] = createResource(
    () => ({ sessionID: props.panel.sessionID, revision: revision() }),
    async ({ sessionID }) => {
      const session = props.context.data.session.get(sessionID)
      const messages = await fetchAllTrajectoryMessages(props.context.client, sessionID)
      return buildTrajectoryViewModel({ sessionID, title: session?.title ?? sessionID, messages })
    },
  )
  const items = createMemo(() => filterTrajectoryItems(trajectory()?.items ?? [], query()))
  const selectedItem = createMemo(() => {
    const rows = items()
    return rows.find((item) => item.id === selectedItemID()) ?? rows[0]
  })
  const wide = () => props.panel.width >= 100
  const compact = () => props.panel.width < 70
  const showDetails = () => wide() || detailOpen()
  const detailTabs = createMemo(() => (selectedItem() ? trajectoryDetailTabs(selectedItem()!) : []))
  const detailTab = createMemo<TrajectoryDetailTab>(() => detailTabs()[detailTabIndex()] ?? "summary")

  createEffect(() => {
    const rows = items()
    const selected = selectedItemID()
    if (rows.length > 0 && !rows.some((item) => item.id === selected)) setSelectedItemID(rows[0]!.id)
  })

  createEffect(() => {
    const selected = selectedItemID()
    if (!selected || !listScroll || listScroll.isDestroyed) return
    queueMicrotask(() => {
      if (!listScroll || listScroll.isDestroyed) return
      listScroll.scrollChildIntoView(`trajectory-row-${selected}`)
    })
  })

  onMount(() => {
    const stop = props.context.data.listen(({ details }) => {
      if (!liveRefreshEvents.has(details.type) || !eventBelongsToSession(details, props.panel.sessionID)) return
      setRevision((value) => value + 1)
      void refetch()
    })
    onCleanup(stop)
  })

  const move = (delta: number) => {
    setSelectedItemID((current) => moveSelection(items(), current, delta))
    setDetailTabIndex(0)
  }
  const search = async () => {
    const value = await props.context.ui.dialog.prompt({
      title: "Search trajectory",
      placeholder: "Message text, tool, payload, or result",
      value: query(),
    })
    if (value === undefined) return
    setQuery(value)
    setSelectedItemID(undefined)
  }
  const cycleTab = (delta: number) => {
    const tabs = detailTabs()
    if (tabs.length === 0) return
    setDetailTabIndex((current) => (current + tabs.length + delta) % tabs.length)
  }

  props.context.keymap.layer(() => ({
    enabled: () => props.panel.focused,
    priority: 100,
    commands: [
      { id: "trajectory.previous", title: "Previous trajectory event", bind: "up,k", run: () => move(-1) },
      { id: "trajectory.next", title: "Next trajectory event", bind: "down,j", run: () => move(1) },
      {
        id: "trajectory.inspect",
        title: "Inspect trajectory event",
        bind: "return",
        run: () => setDetailOpen(true),
      },
      { id: "trajectory.search", title: "Search trajectory", bind: "/", run: search },
      { id: "trajectory.next-section", title: "Next detail section", bind: "tab", run: () => cycleTab(1) },
      {
        id: "trajectory.previous-section",
        title: "Previous detail section",
        bind: "shift+tab",
        run: () => cycleTab(-1),
      },
      {
        id: "trajectory.close",
        title: "Close trajectory",
        bind: "escape",
        run: () => {
          if (!wide() && detailOpen()) {
            setDetailOpen(false)
            return
          }
          props.panel.close()
        },
      },
    ],
  }))

  const theme = () => props.context.theme
  const summary = () => trajectory()?.summary

  return (
    <box width="100%" height="100%" minWidth={0} minHeight={0} flexDirection="column" backgroundColor={theme().background.default}>
      <Show
        when={!compact()}
        fallback={
          <box height={2} flexDirection="column" paddingLeft={1} paddingRight={1}>
            <text fg={theme().text.default} attributes={TextAttributes.BOLD}>
              trajectory · {trajectory()?.title ?? "Loading…"}
            </text>
            <text fg={theme().text.subdued}>
              {trajectory()
                ? `${formatTrajectoryDuration(trajectory()!.durationMs)} · ${summary()!.turnCount} turns · ${summary()!.toolCallCount} calls`
                : "loading"}
            </text>
          </box>
        }
      >
        <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
          <text fg={theme().text.default} attributes={TextAttributes.BOLD}>
            trajectory · {trajectory()?.title ?? "Loading…"}
          </text>
          <text fg={theme().text.subdued}>
            {trajectory()
              ? `${formatTrajectoryDuration(trajectory()!.durationMs)} · ${summary()!.turnCount} turns · ${summary()!.toolCallCount} calls`
              : "loading"}
          </text>
        </box>
      </Show>
      <Show when={query()}>
        <text fg={theme().text.feedback.info.default} paddingLeft={1}>
          Search: {query()} · {items().length} matches
        </text>
      </Show>
      <Show when={trajectory()}>
        {(value) => (
          <Show
            when={!compact()}
            fallback={
              <text fg={theme().text.subdued} paddingLeft={1}>
                {value().status} · {value().summary.stepCount} steps
              </text>
            }
          >
            <TrajectoryTimeline
              context={props.context}
              trajectory={value()}
              selectedItemID={selectedItemID()}
              width={props.panel.width}
            />
          </Show>
        )}
      </Show>
      <box height={1} backgroundColor={theme().border.default} />
      <Show
        when={!trajectory.error}
        fallback={
          <text fg={theme().text.feedback.error.default} padding={1}>
            Could not load trajectory. Reopen /trajectory to try again.
          </text>
        }
      >
        <Show when={trajectory()} fallback={<text fg={theme().text.subdued}>Loading trajectory…</text>}>
          <box flexGrow={1} minHeight={0} minWidth={0} flexDirection="row">
            <Show when={!showDetails() || wide()}>
              <box flexGrow={1} width={wide() ? "52%" : "100%"} minWidth={0} minHeight={0} paddingLeft={1} paddingRight={1}>
                <TrajectoryEventList
                  context={props.context}
                  items={items()}
                  selectedItemID={selectedItem()?.id}
                  width={wide() ? Math.floor(props.panel.width * 0.52) : props.panel.width}
                  onSelect={(id) => setSelectedItemID(id)}
                  onOpen={(id) => {
                    setSelectedItemID(id)
                    setDetailOpen(true)
                  }}
                  onReady={(scroll) => (listScroll = scroll)}
                />
              </box>
            </Show>
            <Show when={showDetails() && selectedItem()}>
              {(item) => (
                <TrajectoryEventDetails context={props.context} item={item()} tab={detailTab()} />
              )}
            </Show>
          </box>
        </Show>
      </Show>
      <text fg={theme().text.subdued} paddingLeft={1}>
        ↑↓/jk select · enter inspect · / search · tab section · esc close
      </text>
    </box>
  )
}
