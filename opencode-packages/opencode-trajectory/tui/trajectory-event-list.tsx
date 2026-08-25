/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { TextAttributes } from "@opentui/core"
import type { Plugin } from "@opencode-ai/plugin/tui"
import { For, Show } from "solid-js"

import type { TrajectoryItem } from "../src/trajectory-data.js"

function trajectoryItemLabel(item: TrajectoryItem): string {
  if (item.type === "tool") return "TOOL"
  if (item.type === "reasoning") return "THINK"
  if (item.type === "compaction") return "COMPACT"
  return item.type.toUpperCase()
}

function singleLineSummary(value: string, width: number): string {
  const line = value.replaceAll(/\s+/g, " ").trim()
  if (line.length <= width) return line
  return `${line.slice(0, Math.max(1, width - 1))}…`
}

export function TrajectoryEventList(props: {
  readonly context: Plugin.Context
  readonly items: readonly TrajectoryItem[]
  readonly selectedItemID?: string
  readonly width: number
  readonly onSelect: (itemID: string) => void
  readonly onOpen: (itemID: string) => void
  readonly onReady: (scroll: ScrollBoxRenderable) => void
}) {
  const theme = () => props.context.theme
  const summaryWidth = () => Math.max(12, props.width - 14)

  return (
    <scrollbox
      ref={(value: ScrollBoxRenderable) => props.onReady(value)}
      flexGrow={1}
      minHeight={0}
      verticalScrollbarOptions={{ visible: true }}
      horizontalScrollbarOptions={{ visible: false }}
    >
      <Show when={props.items.length > 0} fallback={<text fg={theme().text.subdued}>No trajectory events.</text>}>
        <For each={props.items}>
          {(item, index) => {
            const selected = () => item.id === props.selectedItemID
            const previousTurn = () => (index() === 0 ? undefined : props.items[index() - 1]?.turn)
            return (
              <>
                <Show when={item.turn !== undefined && item.turn !== previousTurn()}>
                  <text fg={theme().text.subdued}>Turn {item.turn}</text>
                </Show>
                <box
                  id={`trajectory-row-${item.id}`}
                  flexDirection="row"
                  height={1}
                  backgroundColor={selected() ? theme().background.surface.offset : undefined}
                  onMouseDown={() => {
                    props.onSelect(item.id)
                    props.onOpen(item.id)
                  }}
                >
                  <text
                    width={11}
                    fg={
                      item.status === "failed"
                        ? theme().text.feedback.error.default
                        : item.status === "running"
                          ? theme().text.status.running
                          : item.type === "tool"
                            ? theme().text.feedback.warning.default
                            : item.type === "user"
                              ? theme().text.feedback.info.default
                              : theme().text.subdued
                    }
                    attributes={selected() ? TextAttributes.BOLD : undefined}
                  >
                    {selected() ? "›" : " "} {trajectoryItemLabel(item)}
                  </text>
                  <text
                    fg={selected() ? theme().text.default : theme().text.subdued}
                    attributes={selected() ? TextAttributes.BOLD : undefined}
                  >
                    {singleLineSummary(item.summary, summaryWidth())}
                  </text>
                </box>
              </>
            )
          }}
        </For>
      </Show>
    </scrollbox>
  )
}
