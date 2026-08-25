import { describe, expect, test } from "bun:test"

import { calculateTrajectoryDuration, formatTrajectoryDuration } from "./trajectory-duration.js"

describe("calculateTrajectoryDuration", () => {
  test("uses the run timestamp instead of input streaming time for a completed tool", () => {
    expect(calculateTrajectoryDuration({ created: 100, ran: 140, completed: 190 })).toBe(50)
  })

  test("returns undefined while an interval has no completion timestamp", () => {
    expect(calculateTrajectoryDuration({ created: 100, ran: 140 })).toBeUndefined()
  })
})

describe("formatTrajectoryDuration", () => {
  test("formats milliseconds, seconds, and minutes compactly", () => {
    expect(formatTrajectoryDuration(46)).toBe("46 ms")
    expect(formatTrajectoryDuration(1_250)).toBe("1.3 s")
    expect(formatTrajectoryDuration(65_000)).toBe("1m 5s")
  })
})
