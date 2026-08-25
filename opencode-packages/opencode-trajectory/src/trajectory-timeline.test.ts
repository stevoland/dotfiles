import { describe, expect, test } from "bun:test"

import { renderTrajectoryLane } from "./trajectory-timeline.js"

describe("renderTrajectoryLane", () => {
  test("keeps zero-duration and selected intervals visible", () => {
    expect(
      renderTrajectoryLane({
        width: 10,
        range: { startedAt: 100, completedAt: 200 },
        intervals: [
          { itemID: "instant", startedAt: 100, completedAt: 100, status: "completed" },
          { itemID: "selected", startedAt: 150, completedAt: 170, status: "completed" },
        ],
        selectedItemID: "selected",
      }),
    ).toBe("━   ███   ")
  })

  test("marks running and failed intervals", () => {
    expect(
      renderTrajectoryLane({
        width: 5,
        range: { startedAt: 0, completedAt: 100 },
        intervals: [
          { itemID: "running", startedAt: 0, status: "running" },
          { itemID: "failed", startedAt: 100, completedAt: 100, status: "failed" },
        ],
      }),
    ).toBe("…   ×")
  })
})
