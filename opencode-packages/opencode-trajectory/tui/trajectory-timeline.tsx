/** @jsxImportSource @opentui/solid */
import { TextAttributes } from "@opentui/core"
import type { Plugin } from "@opencode-ai/plugin/tui"
import { For } from "solid-js"

import type { TrajectoryViewModel } from "../src/trajectory-data.js"
import { renderTrajectoryLane } from "../src/trajectory-timeline.js"

export function TrajectoryTimeline(props: {
  readonly context: Plugin.Context
  readonly trajectory: TrajectoryViewModel
  readonly selectedItemID?: string
  readonly width: number
}) {
  const theme = () => props.context.theme
  const labelWidth = 7
  const laneWidth = () => Math.max(8, props.width - labelWidth - 2)
  const completedAt = () => props.trajectory.completedAt ?? Date.now()

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1}>
      <For each={props.trajectory.lanes}>
        {(lane) => (
          <box flexDirection="row" height={1}>
            <text width={labelWidth} fg={theme().text.subdued} attributes={TextAttributes.BOLD}>
              {lane.type[0]!.toUpperCase() + lane.type.slice(1)}
            </text>
            <text
              fg={
                lane.type === "input"
                  ? theme().text.feedback.success.default
                  : lane.type === "model"
                    ? theme().text.feedback.info.default
                    : theme().text.feedback.warning.default
              }
            >
              {renderTrajectoryLane({
                width: laneWidth(),
                range: {
                  startedAt: props.trajectory.startedAt ?? 0,
                  completedAt: completedAt(),
                },
                intervals: lane.intervals,
                selectedItemID: props.selectedItemID,
              })}
            </text>
          </box>
        )}
      </For>
    </box>
  )
}
