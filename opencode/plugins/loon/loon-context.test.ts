import { describe, expect, test } from "bun:test"

import { loonContextUsage, loonCorruptionLevel } from "./loon-context"

const model = { providerID: "test", id: "reasoner", limit: { context: 100_000, output: 10_000 } }
const assistant = (id: string, input: number) => ({
  id,
  type: "assistant",
  model: { providerID: "test", id: "reasoner" },
  tokens: { input, output: 10, reasoning: 20, cache: { read: 30, write: 40 } },
})

describe("loon context window use", () => {
  test("uses the latest total after compaction, not accumulated lifetime tokens", () => {
    const messages = [assistant("old", 800), { id: "compact", type: "compaction", status: "completed" }, assistant("new", 400)]
    expect(loonContextUsage(messages, [model])).toEqual({ tokens: 500, limit: 100_000, output: 10_000 })
    expect(loonContextUsage(messages, [model], "new")).toBeUndefined()
  })

  test("selects the actual assistant model and ignores missing limits", () => {
    const messages = [assistant("answer", 900)]
    expect(loonContextUsage(messages, [])).toBeUndefined()
    expect(loonContextUsage(messages, [{ ...model, id: "other" }])).toBeUndefined()
    expect(loonContextUsage(messages, [{ ...model, limit: { context: 100_000, output: Number.NaN } }])).toBeUndefined()
    expect(loonContextUsage(messages, [model], "absent")).toBeUndefined()
  })

  test("reaches maximum corruption at context minus output minus 20k", () => {
    expect(loonCorruptionLevel()).toBe(0)
    expect(loonCorruptionLevel({ tokens: 6_999, limit: 100_000, output: 10_000 })).toBe(0)
    expect(loonCorruptionLevel({ tokens: 7_000, limit: 100_000, output: 10_000 })).toBe(1)
    expect(loonCorruptionLevel({ tokens: 35_000, limit: 100_000, output: 10_000 })).toBe(5)
    expect(loonCorruptionLevel({ tokens: 69_999, limit: 100_000, output: 10_000 })).toBe(9)
    expect(loonCorruptionLevel({ tokens: 70_000, limit: 100_000, output: 10_000 })).toBe(10)
    expect(loonCorruptionLevel({ tokens: 50_000, limit: 100_000, output: 30_000 })).toBe(10)
    expect(loonCorruptionLevel({ tokens: 80_000, limit: 100_000, output: 10_000 })).toBe(10)
    expect(loonCorruptionLevel({ tokens: 10, limit: 20_000, output: 10_000 })).toBe(0)
  })
})
