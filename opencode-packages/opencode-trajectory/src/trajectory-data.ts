import type { SessionMessageInfo } from "@opencode-ai/client"

import { calculateTrajectoryDuration } from "./trajectory-duration.js"

export type TrajectoryStatus = "running" | "completed" | "failed" | "interrupted"
export type TrajectoryItemType =
  | "system"
  | "context"
  | "user"
  | "assistant"
  | "reasoning"
  | "tool"
  | "retry"
  | "compaction"

export type TrajectoryItemBase = {
  readonly id: string
  readonly type: TrajectoryItemType
  readonly sequence: number
  readonly turn?: number
  readonly step?: number
  readonly status: TrajectoryStatus
  readonly startedAt: number
  readonly completedAt?: number
  readonly durationMs?: number
  readonly summary: string
  readonly searchableText: string
}

export type TrajectoryTextItem = TrajectoryItemBase & {
  readonly type: "system" | "context" | "user" | "assistant" | "reasoning"
  readonly text: string
  readonly description?: string
  readonly model?: string
  readonly agent?: string
}

export type TrajectoryToolItem = TrajectoryItemBase & {
  readonly type: "tool"
  readonly toolName: string
  readonly input: unknown
  readonly output?: string
  readonly error?: string
  readonly metadata?: unknown
  readonly executed?: boolean
}

export type TrajectoryRetryItem = TrajectoryItemBase & {
  readonly type: "retry"
  readonly attempt: number
  readonly error: string
}

export type TrajectoryCompactionItem = TrajectoryItemBase & {
  readonly type: "compaction"
  readonly reason: "auto" | "manual"
  readonly recent?: string
  readonly error?: string
}

export type TrajectoryItem = TrajectoryTextItem | TrajectoryToolItem | TrajectoryRetryItem | TrajectoryCompactionItem
type TrajectoryItemWithoutSequence = TrajectoryItem extends infer Item
  ? Item extends TrajectoryItem
    ? Omit<Item, "sequence">
    : never
  : never

export type TrajectoryInterval = {
  readonly itemID: string
  readonly startedAt: number
  readonly completedAt?: number
  readonly status: TrajectoryStatus
}

export type TrajectoryLane = {
  readonly type: "input" | "model" | "tools"
  readonly intervals: readonly TrajectoryInterval[]
}

export type TrajectoryTurn = {
  readonly number: number
  readonly userItemID?: string
  readonly itemIDs: readonly string[]
  readonly startedAt: number
  readonly completedAt?: number
}

export type TrajectorySummary = {
  readonly turnCount: number
  readonly stepCount: number
  readonly toolCallCount: number
  readonly failedToolCallCount: number
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cost?: number
}

export type TrajectoryViewModel = {
  readonly sessionID: string
  readonly title: string
  readonly status: "idle" | TrajectoryStatus
  readonly startedAt?: number
  readonly completedAt?: number
  readonly durationMs?: number
  readonly summary: TrajectorySummary
  readonly lanes: readonly TrajectoryLane[]
  readonly turns: readonly TrajectoryTurn[]
  readonly items: readonly TrajectoryItem[]
  readonly itemsByID: ReadonlyMap<string, TrajectoryItem>
}

type BuildTrajectoryInput = {
  readonly sessionID: string
  readonly title: string
  readonly messages: readonly SessionMessageInfo[]
}

function stringifyTrajectoryValue(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function trajectoryToolOutput(
  content: ReadonlyArray<{ readonly type: string; readonly text?: string; readonly uri?: string }> | undefined,
): string | undefined {
  if (!content) return undefined
  return content.map((part) => (part.type === "text" ? part.text : part.uri)).filter(Boolean).join("\n")
}

function trajectoryStatus(completedAt: number | undefined, failed = false): TrajectoryStatus {
  if (failed) return "failed"
  return completedAt === undefined ? "running" : "completed"
}

/** Builds the searchable trajectory view model from messages in server-provided chronological order. */
export function buildTrajectoryViewModel(input: BuildTrajectoryInput): TrajectoryViewModel {
  const items: TrajectoryItem[] = []
  let turn = 0
  let step = 0
  let stepCount = 0
  let sequence = 0
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let cost: number | undefined

  const push = (item: TrajectoryItemWithoutSequence) => {
    items.push({ ...item, sequence: sequence++ } as TrajectoryItem)
  }

  for (const message of input.messages) {
    if (message.type === "user") {
      turn += 1
      step = 0
      push({
        id: message.id,
        type: "user",
        turn,
        status: "completed",
        startedAt: message.time.created,
        completedAt: message.time.created,
        durationMs: 0,
        text: message.text,
        summary: message.text || "User input",
        searchableText: [message.text, ...(message.files?.map((file) => file.name ?? file.description ?? "") ?? [])]
          .join(" ")
          .toLowerCase(),
      })
      continue
    }

    if (message.type === "assistant") {
      step += 1
      stepCount += 1
      inputTokens = (inputTokens ?? 0) + (message.tokens?.input ?? 0)
      outputTokens = (outputTokens ?? 0) + (message.tokens?.output ?? 0)
      cost = (cost ?? 0) + (message.cost ?? 0)
      let hasAssistantText = false

      message.content.forEach((part, index) => {
        if (part.type === "reasoning") {
          const startedAt = part.time?.created ?? message.time.created
          const completedAt = part.time?.completed
          push({
            id: `${message.id}:reasoning:${index}`,
            type: "reasoning",
            turn: turn || undefined,
            step,
            status: trajectoryStatus(completedAt),
            startedAt,
            completedAt,
            durationMs: calculateTrajectoryDuration({ created: startedAt, completed: completedAt }),
            text: part.text,
            summary: part.text || "Reasoning",
            searchableText: part.text.toLowerCase(),
            model: `${message.model.providerID}/${message.model.id}`,
            agent: message.agent,
          })
          return
        }

        if (part.type === "text") {
          hasAssistantText = true
          push({
            id: `${message.id}:text:${index}`,
            type: "assistant",
            turn: turn || undefined,
            step,
            status: trajectoryStatus(message.time.completed, Boolean(message.error)),
            startedAt: message.time.created,
            completedAt: message.time.completed,
            durationMs: calculateTrajectoryDuration(message.time),
            text: part.text,
            summary: part.text || "Assistant response",
            searchableText: [part.text, message.agent, message.model.providerID, message.model.id]
              .join(" ")
              .toLowerCase(),
            model: `${message.model.providerID}/${message.model.id}`,
            agent: message.agent,
          })
          return
        }

        const output = trajectoryToolOutput(part.state.status === "completed" || part.state.status === "error" ? part.state.content : undefined)
        const error = part.state.status === "error" ? part.state.error.message : undefined
        const toolInput = part.state.input
        const summarySuffix = error ?? output ?? (part.state.status === "streaming" ? part.state.input : part.state.status)
        push({
          id: part.id,
          type: "tool",
          turn: turn || undefined,
          step,
          status: part.state.status === "error" ? "failed" : trajectoryStatus(part.time.completed),
          startedAt: part.time.ran ?? part.time.created,
          completedAt: part.time.completed,
          durationMs: calculateTrajectoryDuration(part.time),
          toolName: part.name,
          input: toolInput,
          output,
          error,
          metadata: "metadata" in part.state ? part.state.metadata : undefined,
          executed: part.executed,
          summary: `${part.name} → ${summarySuffix}`,
          searchableText: [part.name, stringifyTrajectoryValue(toolInput), output, error].filter(Boolean).join(" ").toLowerCase(),
        })
      })

      if (!hasAssistantText && message.content.some((part) => part.type === "tool")) {
        push({
          id: `${message.id}:assistant`,
          type: "assistant",
          turn: turn || undefined,
          step,
          status: trajectoryStatus(message.time.completed, Boolean(message.error)),
          startedAt: message.time.created,
          completedAt: message.time.completed,
          durationMs: calculateTrajectoryDuration(message.time),
          text: "(tool call only)",
          summary: "(tool call only)",
          searchableText: [message.agent, message.model.providerID, message.model.id].join(" ").toLowerCase(),
          model: `${message.model.providerID}/${message.model.id}`,
          agent: message.agent,
        })
      }

      if (message.retry) {
        push({
          id: `${message.id}:retry:${message.retry.attempt}`,
          type: "retry",
          turn: turn || undefined,
          step,
          status: "completed",
          startedAt: message.retry.at,
          completedAt: message.retry.at,
          durationMs: 0,
          attempt: message.retry.attempt,
          error: message.retry.error.message,
          summary: `Retry ${message.retry.attempt}: ${message.retry.error.message}`,
          searchableText: `retry ${message.retry.attempt} ${message.retry.error.message}`.toLowerCase(),
        })
      }
      continue
    }

    if (message.type === "system" || message.type === "synthetic" || message.type === "skill") {
      const text = message.type === "skill" ? message.text : message.text
      const description = message.type === "skill" ? message.name : message.description
      push({
        id: message.id,
        type: message.type === "system" ? "system" : "context",
        turn: turn || undefined,
        status: "completed",
        startedAt: message.time.created,
        completedAt: message.time.created,
        durationMs: 0,
        text,
        description,
        summary: description ?? text,
        searchableText: [description, text].filter(Boolean).join(" ").toLowerCase(),
      })
      continue
    }

    if (message.type === "compaction") {
      const error = message.status === "failed" ? message.error.message : undefined
      push({
        id: message.id,
        type: "compaction",
        turn: turn || undefined,
        status: message.status === "failed" ? "failed" : message.status === "running" ? "running" : "completed",
        startedAt: message.time.created,
        completedAt: message.status === "running" ? undefined : message.time.created,
        durationMs: message.status === "running" ? undefined : 0,
        reason: message.reason,
        recent: message.status === "failed" ? undefined : message.recent,
        error,
        summary: error ? `Compaction failed: ${error}` : `${message.reason} compaction`,
        searchableText: ["compaction", message.reason, error, message.status === "failed" ? undefined : message.summary]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })
      continue
    }

    if (message.type === "shell") {
      const completedAt = message.time.completed
      push({
        id: message.id,
        type: "tool",
        turn: turn || undefined,
        status: message.status === "running" ? "running" : message.exit === 0 ? "completed" : "failed",
        startedAt: message.time.created,
        completedAt,
        durationMs: calculateTrajectoryDuration(message.time),
        toolName: "shell",
        input: { command: message.command },
        output: message.output?.output,
        error: message.status === "timeout" || message.status === "killed" ? message.status : undefined,
        summary: `shell → ${message.output?.output ?? message.status}`,
        searchableText: ["shell", message.command, message.output?.output, message.status].filter(Boolean).join(" ").toLowerCase(),
      })
      continue
    }

    const summary =
      message.type === "agent-switched"
        ? `Agent changed to ${message.agent}`
        : message.type === "model-switched"
          ? `Model changed to ${message.model.providerID}/${message.model.id}`
          : `Location changed to ${message.location.directory}`
    push({
      id: message.id,
      type: "context",
      turn: turn || undefined,
      status: "completed",
      startedAt: message.time.created,
      completedAt: message.time.created,
      durationMs: 0,
      text: summary,
      summary,
      searchableText: summary.toLowerCase(),
    })
  }

  const turns: TrajectoryTurn[] = []
  for (let number = 1; number <= turn; number += 1) {
    const turnItems = items.filter((item) => item.turn === number)
    const startedAt = Math.min(...turnItems.map((item) => item.startedAt))
    const completedValues = turnItems.map((item) => item.completedAt)
    const completedAt = completedValues.some((value) => value === undefined)
      ? undefined
      : Math.max(...(completedValues as number[]))
    turns.push({
      number,
      userItemID: turnItems.find((item) => item.type === "user")?.id,
      itemIDs: turnItems.map((item) => item.id),
      startedAt,
      completedAt,
    })
  }

  const lane = (type: TrajectoryLane["type"], selected: readonly TrajectoryItemType[]): TrajectoryLane => ({
    type,
    intervals: items
      .filter((item) => selected.includes(item.type))
      .map((item) => ({
        itemID: item.id,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        status: item.status,
      })),
  })
  const startedAt = items.length > 0 ? Math.min(...items.map((item) => item.startedAt)) : undefined
  const hasRunning = items.some((item) => item.status === "running")
  const completedAt =
    !hasRunning && items.length > 0 ? Math.max(...items.map((item) => item.completedAt ?? item.startedAt)) : undefined
  const failed = items.some((item) => item.status === "failed")

  return {
    sessionID: input.sessionID,
    title: input.title,
    status: hasRunning ? "running" : failed ? "failed" : "idle",
    startedAt,
    completedAt,
    durationMs:
      startedAt === undefined || completedAt === undefined ? undefined : Math.max(0, completedAt - startedAt),
    summary: {
      turnCount: turn,
      stepCount,
      toolCallCount: items.filter((item) => item.type === "tool").length,
      failedToolCallCount: items.filter((item) => item.type === "tool" && item.status === "failed").length,
      inputTokens: inputTokens === 0 ? undefined : inputTokens,
      outputTokens: outputTokens === 0 ? undefined : outputTokens,
      cost: cost === 0 ? undefined : cost,
    },
    lanes: [lane("input", ["system", "context", "user"]), lane("model", ["assistant", "reasoning"]), lane("tools", ["tool"])],
    turns,
    items,
    itemsByID: new Map(items.map((item) => [item.id, item])),
  }
}

/** Filters trajectory rows using their normalized case-insensitive search text. */
export function filterTrajectoryItems(items: readonly TrajectoryItem[], query: string): readonly TrajectoryItem[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return items
  return items.filter((item) => item.searchableText.includes(normalized))
}
