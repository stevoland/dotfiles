/** @jsxImportSource @opentui/solid */
import { TextAttributes } from "@opentui/core"
import type { Plugin } from "@opencode-ai/plugin/tui"
import { For, Show } from "solid-js"

import type { TrajectoryItem } from "../src/trajectory-data.js"
import { formatTrajectoryDuration } from "../src/trajectory-duration.js"

export type TrajectoryDetailTab = "summary" | "payload" | "result" | "timing"

/** Returns detail tabs backed by actual data for one trajectory item. */
export function trajectoryDetailTabs(item: TrajectoryItem): readonly TrajectoryDetailTab[] {
  const tabs: TrajectoryDetailTab[] = ["summary"]
  if (item.type === "tool") {
    tabs.push("payload")
    if (item.output !== undefined || item.error !== undefined) tabs.push("result")
  } else if (item.type === "assistant" || item.type === "reasoning" || item.type === "user") {
    tabs.push("result")
  }
  tabs.push("timing")
  return tabs
}

function formattedValue(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function DetailBody(props: { readonly item: TrajectoryItem; readonly tab: TrajectoryDetailTab }) {
  const value = () => {
    if (props.tab === "payload" && props.item.type === "tool") return formattedValue(props.item.input)
    if (props.tab === "result" && props.item.type === "tool") return props.item.error ?? props.item.output ?? "No result"
    if (props.tab === "result" && "text" in props.item) return props.item.text
    return undefined
  }

  return (
    <Show
      when={props.tab !== "summary" && props.tab !== "timing"}
      fallback={
        <box flexDirection="column" gap={1}>
          <Show when={props.tab === "summary"}>
            <text>Status     {props.item.status}</text>
            <text>Type       {props.item.type}</text>
            <Show when={props.item.turn !== undefined}>
              <text>Turn       {props.item.turn}</text>
            </Show>
            <Show when={props.item.step !== undefined}>
              <text>Step       {props.item.step}</text>
            </Show>
            <Show when={props.item.type === "tool"}>
              <text>Tool       {props.item.type === "tool" ? props.item.toolName : ""}</text>
            </Show>
            <Show when={"model" in props.item && props.item.model}>
              <text>Model      {"model" in props.item ? props.item.model : ""}</text>
            </Show>
          </Show>
          <Show when={props.tab === "timing"}>
            <text>Started    {new Date(props.item.startedAt).toISOString()}</text>
            <text>Completed  {props.item.completedAt ? new Date(props.item.completedAt).toISOString() : "running"}</text>
            <text>Duration   {formatTrajectoryDuration(props.item.durationMs)}</text>
          </Show>
        </box>
      }
    >
      <text wrapMode="word">{value()}</text>
    </Show>
  )
}

export function TrajectoryEventDetails(props: {
  readonly context: Plugin.Context
  readonly item: TrajectoryItem
  readonly tab: TrajectoryDetailTab
}) {
  const theme = () => props.context.theme
  const tabs = () => trajectoryDetailTabs(props.item)

  return (
    <box flexGrow={1} minWidth={0} minHeight={0} flexDirection="column" paddingLeft={2} paddingRight={1}>
      <text fg={theme().text.default} attributes={TextAttributes.BOLD}>
        {props.item.type.toUpperCase()} · Turn {props.item.turn ?? "—"} · Step {props.item.step ?? "—"}
      </text>
      <box flexDirection="row" gap={2} marginTop={1} marginBottom={1}>
        <For each={tabs()}>
          {(tab) => (
            <text
              fg={tab === props.tab ? theme().text.feedback.info.default : theme().text.subdued}
              attributes={tab === props.tab ? TextAttributes.BOLD | TextAttributes.UNDERLINE : undefined}
            >
              {tab[0]!.toUpperCase() + tab.slice(1)}
            </text>
          )}
        </For>
      </box>
      <scrollbox flexGrow={1} minHeight={0} verticalScrollbarOptions={{ visible: true }}>
        <DetailBody item={props.item} tab={props.tab} />
      </scrollbox>
    </box>
  )
}
