import { expect, test } from "bun:test"
import type { SessionMessageInfo } from "@opencode/client"

import { barGlyphs, fractionColor, previousCompactionCount } from "./power-bar"

const compactionMessage = (id: string, status: "completed" | "running"): SessionMessageInfo => ({
  id,
  type: "compaction",
  time: { created: 0 },
  status,
  reason: "auto",
  summary: "",
  recent: "",
})

test("power bar colours retain their hues at reduced brightness", () => {
  expect(fractionColor(1)).toBe("#008060")
  expect(fractionColor(0.5)).toBe("#508000")
  expect(fractionColor(0)).toBe("#800000")
})

test("power bar uses heavy horizontal-line glyphs for its fill", () => {
  expect(barGlyphs(1, 4)).toEqual({ filled: "━━━━", track: 0 })
  expect(barGlyphs(0.5, 4)).toEqual({ filled: "━━", track: 2 })
  expect(barGlyphs(0, 4)).toEqual({ filled: "", track: 4 })
})

test("power bar rounds to whole columns and preserves its width", () => {
  expect(barGlyphs(0.4, 4)).toEqual({ filled: "━━", track: 2 })
  expect(barGlyphs(1, 0)).toEqual({ filled: "", track: 0 })
})

test("previous compaction count includes only completed compactions", () => {
  expect(previousCompactionCount([])).toBe(0)
  expect(
    previousCompactionCount([compactionMessage("done", "completed"), compactionMessage("running", "running")]),
  ).toBe(1)
})
