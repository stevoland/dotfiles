import { describe, expect, test } from "bun:test"
import type { SessionMessageInfo } from "@opencode-ai/client"

import { buildTrajectoryViewModel, filterTrajectoryItems } from "./trajectory-data.js"

const messages = [
  {
    id: "msg_system",
    type: "system",
    text: "Follow repository instructions",
    description: "Initial instructions",
    time: { created: 10 },
  },
  {
    id: "msg_user",
    type: "user",
    text: "Read the config",
    time: { created: 20 },
  },
  {
    id: "msg_assistant",
    type: "assistant",
    agent: "build",
    model: { providerID: "test", id: "fixture" },
    finish: "tool-calls",
    time: { created: 30, completed: 90 },
    content: [
      { type: "reasoning", text: "I should inspect it", time: { created: 31, completed: 40 } },
      { type: "text", text: "Inspecting the config." },
      {
        type: "tool",
        id: "call_read",
        name: "read",
        time: { created: 41, ran: 50, completed: 80 },
        state: {
          status: "completed",
          input: { file_path: "opencode.jsonc" },
          content: [{ type: "text", text: "{ plugins: [] }" }],
        },
      },
    ],
  },
] satisfies SessionMessageInfo[]

describe("buildTrajectoryViewModel", () => {
  test("groups projected session content into a turn and typed timeline lanes", () => {
    const result = buildTrajectoryViewModel({
      sessionID: "ses_test",
      title: "Inspect config",
      messages,
    })

    expect(result.summary).toEqual({
      turnCount: 1,
      stepCount: 1,
      toolCallCount: 1,
      failedToolCallCount: 0,
      inputTokens: undefined,
      outputTokens: undefined,
      cost: undefined,
    })
    expect(result.turns).toHaveLength(1)
    expect(result.items.map((item) => item.type)).toEqual([
      "system",
      "user",
      "reasoning",
      "assistant",
      "tool",
    ])
    expect(result.items.find((item) => item.type === "tool")).toMatchObject({
      id: "call_read",
      turn: 1,
      step: 1,
      status: "completed",
      durationMs: 30,
      input: { file_path: "opencode.jsonc" },
      output: "{ plugins: [] }",
    })
    expect(result.lanes.map((lane) => [lane.type, lane.intervals.length])).toEqual([
      ["input", 2],
      ["model", 2],
      ["tools", 1],
    ])
  })

  test("keeps running and failed tools as explicit states", () => {
    const result = buildTrajectoryViewModel({
      sessionID: "ses_tools",
      title: "Tool states",
      messages: [
        { id: "user", type: "user", text: "Run tools", time: { created: 1 } },
        {
          id: "assistant",
          type: "assistant",
          agent: "build",
          model: { providerID: "test", id: "fixture" },
          time: { created: 2 },
          content: [
            {
              type: "tool",
              id: "running",
              name: "shell",
              time: { created: 3, ran: 4 },
              state: { status: "running", input: { command: "sleep 1" }, metadata: {} },
            },
            {
              type: "tool",
              id: "failed",
              name: "read",
              time: { created: 5, ran: 6, completed: 7 },
              state: {
                status: "error",
                input: { file_path: "missing" },
                error: { type: "NotFound", message: "File not found" },
              },
            },
          ],
        },
      ],
    })

    expect(result.status).toBe("running")
    expect(result.summary.failedToolCallCount).toBe(1)
    expect(result.items.find((item) => item.id === "running")?.status).toBe("running")
    expect(result.items.find((item) => item.id === "failed")?.status).toBe("failed")
  })
})

describe("filterTrajectoryItems", () => {
  test("searches tool names, payloads, results, and message text", () => {
    const result = buildTrajectoryViewModel({ sessionID: "ses_test", title: "Inspect config", messages })

    expect(filterTrajectoryItems(result.items, "OPENCODE.JSONC").map((item) => item.id)).toEqual(["call_read"])
    expect(filterTrajectoryItems(result.items, "plugins").map((item) => item.id)).toEqual(["call_read"])
    expect(filterTrajectoryItems(result.items, "inspect it").map((item) => item.id)).toEqual([
      "msg_assistant:reasoning:0",
    ])
  })
})
