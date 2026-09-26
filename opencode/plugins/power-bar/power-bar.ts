import type { ModelInfo, SessionMessageInfo } from "@opencode/client"

// Mirrors calculateCeiling and hasMeasuredPrompt in packages/core/src/session/compaction.ts (OpenCode v2.0.25).
const RESERVE_MIN = 16_000

/** Prompt tokens at which OpenCode auto-compacts, or undefined when the model has no known window. */
export function compactionThreshold(limit: ModelInfo["limit"], buffer?: number) {
  const window = limit.input || limit.context
  if (window <= 0) return undefined
  if (buffer !== undefined) return window - buffer
  return window - Math.max(Math.floor(window * 0.1), window >= 2 * RESERVE_MIN ? RESERVE_MIN : 0)
}

/** Prompt size reported by the last successful turn on this provider since the most recent completed compaction. */
export function lastUsage(messages: readonly SessionMessageInfo[], providerID?: string) {
  const compactionIndex = messages.findLastIndex(
    (message) => message.type === "compaction" && message.status === "completed",
  )
  for (let index = messages.length - 1; index > compactionIndex; index--) {
    const message = messages[index]
    if (message?.type !== "assistant" || message.error || !message.tokens) continue
    if (providerID !== undefined && message.model.providerID !== providerID) continue
    const { tokens } = message
    if (tokens.input + tokens.cache.read + tokens.cache.write <= 0) continue
    return {
      model: message.model,
      tokens: tokens.input + tokens.cache.read + tokens.cache.write + tokens.output + tokens.reasoning,
    }
  }
  return undefined
}

/** Counts completed compactions in the current session history. */
export function previousCompactionCount(messages: readonly SessionMessageInfo[]) {
  return messages.filter((message) => message.type === "compaction" && message.status === "completed").length
}

/** Fraction of the pre-compaction budget still available, from 1 (fresh) to 0 (compacting). */
export function remainingFraction(tokens: number, threshold: number) {
  if (threshold <= 0) return 0
  return Math.min(1, Math.max(0, 1 - tokens / threshold))
}

/** Darker power bar colours: mint (165°) through yellow to red (0°), at 25% lightness as #rrggbb. */
export function fractionColor(fraction: number) {
  const hue = fraction * 165
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12
    const value = 0.25 - 0.25 * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(value * 255).toString(16).padStart(2, "0")
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

/** Splits a power bar of `width` cells into heavy horizontal-line glyphs and the empty track length. */
export function barGlyphs(fraction: number, width: number) {
  const full = Math.round(fraction * width)
  return { filled: "━".repeat(full), track: Math.max(0, width - full) }
}
