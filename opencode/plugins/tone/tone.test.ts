import { describe, expect, test } from "bun:test"

import { isToneID, isToneSystemReminder, toneSystemReminder } from "./tone"

const LOON_PROMPT = "You are the loon tone."

describe("assistant tone reminders", () => {
  test("recognizes the supported tone identifiers", () => {
    expect(isToneID("default")).toBe(true)
    expect(isToneID("lad")).toBe(true)
    expect(isToneID("loon")).toBe(true)
    expect(isToneID("simple")).toBe(true)
    expect(isToneID("formal")).toBe(false)
  })

  test("supersedes earlier tone instructions", () => {
    expect(toneSystemReminder("default", LOON_PROMPT)).toContain("Any earlier assistant-tone reminders no longer apply")
    expect(toneSystemReminder("lad", LOON_PROMPT)).toContain("Northern English expressions")
    expect(toneSystemReminder("loon", LOON_PROMPT)).toContain(LOON_PROMPT)
    expect(toneSystemReminder("simple", LOON_PROMPT)).toContain("ASD-STE100 Simplified Technical English")
  })

  test("recognizes only this plug-in's durable reminders", () => {
    expect(isToneSystemReminder(toneSystemReminder("default", LOON_PROMPT), LOON_PROMPT)).toBe(true)
    expect(isToneSystemReminder(toneSystemReminder("lad", LOON_PROMPT), LOON_PROMPT)).toBe(true)
    expect(isToneSystemReminder(toneSystemReminder("loon", LOON_PROMPT), LOON_PROMPT)).toBe(true)
    expect(isToneSystemReminder(toneSystemReminder("simple", LOON_PROMPT), LOON_PROMPT)).toBe(true)
    expect(isToneSystemReminder("<system-reminder>Be concise.</system-reminder>", LOON_PROMPT)).toBe(false)
  })
})
