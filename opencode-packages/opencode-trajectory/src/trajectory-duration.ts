export type TrajectoryTimestampRange = {
  readonly created: number
  readonly ran?: number
  readonly completed?: number
}

/** Calculates a completed trajectory interval in milliseconds, using tool execution time when present. */
export function calculateTrajectoryDuration(range: TrajectoryTimestampRange): number | undefined {
  if (range.completed === undefined) return undefined
  return Math.max(0, range.completed - (range.ran ?? range.created))
}

/** Formats a millisecond trajectory duration for compact terminal display. */
export function formatTrajectoryDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) return "running"
  if (durationMs < 1_000) return `${Math.round(durationMs)} ms`
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(1)} s`

  const minutes = Math.floor(durationMs / 60_000)
  const seconds = Math.round((durationMs % 60_000) / 1_000)
  return `${minutes}m ${seconds}s`
}
