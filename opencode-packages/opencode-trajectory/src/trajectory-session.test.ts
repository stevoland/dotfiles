import { describe, expect, test } from "bun:test"
import type { SessionMessageInfo, SessionMessagesResponse } from "@opencode-ai/client"

import { fetchAllTrajectoryMessages } from "./trajectory-session.js"

const message = (id: string): SessionMessageInfo => ({
  id,
  type: "user",
  text: id,
  time: { created: Number(id.slice(1)) },
})

describe("fetchAllTrajectoryMessages", () => {
  test("follows opaque forward cursors without changing the server order", async () => {
    const calls: unknown[] = []
    const pages: SessionMessagesResponse[] = [
      { data: [message("m1"), message("m2")], cursor: { next: "next-page" } },
      { data: [message("m3")], cursor: {} },
    ]
    const client = {
      message: {
        list: async (input: unknown) => {
          calls.push(input)
          return pages[calls.length - 1]!
        },
      },
    }

    const result = await fetchAllTrajectoryMessages(client, "ses_test")

    expect(result.map((item) => item.id)).toEqual(["m1", "m2", "m3"])
    expect(calls).toEqual([
      { sessionID: "ses_test", limit: 200, order: "asc" },
      { sessionID: "ses_test", limit: 200, cursor: "next-page" },
    ])
  })
})
