import type { SessionMessageInfo, SessionMessagesResponse } from "@opencode-ai/client"

export type TrajectoryMessageClient = {
  readonly message: {
    readonly list: (input: {
      readonly sessionID: string
      readonly limit: number
      readonly order?: "asc"
      readonly cursor?: string
    }) => Promise<SessionMessagesResponse>
  }
}

/** Fetches every projected session message in durable chronological order. */
export async function fetchAllTrajectoryMessages(
  client: TrajectoryMessageClient,
  sessionID: string,
): Promise<SessionMessageInfo[]> {
  const first = await client.message.list({ sessionID, limit: 200, order: "asc" })
  const messages = [...first.data]
  let cursor = first.cursor.next ?? undefined

  while (cursor) {
    const page = await client.message.list({ sessionID, limit: 200, cursor })
    messages.push(...page.data)
    cursor = page.cursor.next ?? undefined
  }

  return messages
}
