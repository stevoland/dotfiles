import type { TrajectoryInterval } from "./trajectory-data.js"

type RenderTrajectoryLaneInput = {
  readonly width: number
  readonly range: {
    readonly startedAt: number
    readonly completedAt: number
  }
  readonly intervals: readonly TrajectoryInterval[]
  readonly selectedItemID?: string
}

/** Renders one scaled trajectory lane, preserving instantaneous intervals as one terminal cell. */
export function renderTrajectoryLane(input: RenderTrajectoryLaneInput): string {
  const width = Math.max(1, Math.floor(input.width))
  const cells = Array.from({ length: width }, () => " ")
  const duration = Math.max(1, input.range.completedAt - input.range.startedAt)
  const position = (timestamp: number) =>
    Math.max(0, Math.min(width - 1, Math.floor(((timestamp - input.range.startedAt) / duration) * (width - 1))))

  for (const interval of input.intervals) {
    const start = position(interval.startedAt)
    const end = interval.completedAt === undefined ? start : Math.max(start, position(interval.completedAt))
    const glyph =
      interval.itemID === input.selectedItemID
        ? "█"
        : interval.status === "failed"
          ? "×"
          : interval.status === "running"
            ? "…"
            : "━"
    for (let index = start; index <= end; index += 1) cells[index] = glyph
  }

  return cells.join("")
}
