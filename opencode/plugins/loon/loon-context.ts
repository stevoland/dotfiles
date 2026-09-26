/** The session usage and model window needed to scale loon corruption. */
export type LoonContextUsage = { tokens: number; limit: number; output: number }

type UsageMessage = {
  id: string
  type: string
  status?: string
  model?: { providerID: string; id: string }
  tokens?: { input: number; output: number; reasoning: number; cache: { read: number; write: number } }
}

type ContextModel = { providerID: string; id: string; limit: { context: number; output: number } }

const CONTEXT_BUFFER_TOKENS = 20_000

/** Matches the TUI context meter: latest usage since compaction, before a staged revert. */
export function loonContextUsage(
  messages: readonly UsageMessage[],
  models: readonly ContextModel[] | undefined,
  revertBoundary?: string,
): LoonContextUsage | undefined {
  const end = revertBoundary ? messages.findIndex((message) => message.id === revertBoundary) : messages.length
  if (end < 0) return undefined
  const compaction = messages.findLastIndex(
    (message, index) => message.type === "compaction" && message.status === "completed" && index < end,
  )
  const last = messages.findLast(
    (message, index) => message.type === "assistant" && message.tokens !== undefined && index > compaction && index < end,
  )
  if (!last?.tokens || !last.model) return undefined
  const model = models?.find((candidate) => candidate.providerID === last.model?.providerID && candidate.id === last.model?.id)
  const limit = model?.limit.context
  const output = model?.limit.output
  if (!limit || !Number.isFinite(limit) || limit <= 0 || output === undefined || !Number.isFinite(output) || output < 0) return undefined
  const tokens = last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
  return Number.isFinite(tokens) && tokens >= 0 ? { tokens, limit, output } : undefined
}

/** Maps context use to 0–10; level 10 starts at context minus max output minus 20k. */
export function loonCorruptionLevel(usage?: LoonContextUsage): number {
  if (!usage || !Number.isFinite(usage.tokens) || !Number.isFinite(usage.limit) || !Number.isFinite(usage.output)) return 0
  const ceiling = usage.limit - usage.output - CONTEXT_BUFFER_TOKENS
  if (usage.tokens < 0 || usage.output < 0 || ceiling <= 0) return 0
  return Math.min(10, Math.floor((usage.tokens / ceiling) * 10))
}
