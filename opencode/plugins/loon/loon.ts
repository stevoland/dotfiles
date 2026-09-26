import { corruptLoon } from "./loon-corruption"
import { loonCorruptionLevel, type LoonContextUsage } from "./loon-context"
import { UNHINGED_POSTSCRIPT_FRAGMENTS } from "./unhinged-postscript-fragments"

/** The message fields needed to derive loon text from completed assistant reasoning and replies. */
export type LoonMessage = {
  id: string
  type: string
  time: { completed?: number }
  content?: readonly {
    type: string
    text?: string
    time?: { completed?: number }
  }[]
}

type CompletedAssistantPart = { key: string; messageID: string; type: "reasoning" | "text"; sentences: string[] }

const LOON_KAOMOJI = [
  "(´；ω；`)ノ", "༼ ↂڡↂ ༽つ⌫", "(◕‿◕)", "(╯°□°)╯︵ ┻━┻",
  "¯\\_(ツ)_/¯", "(ಥ﹏ಥ)", "ლ(ಠ益ಠლ)", "(っ˘̩╭╮˘̩)っ", "◎[▪‿▪]◎"
] as const
const LOON_HASHTAGS = ["#Reasoning", "#StillThinking", "#ThinkItThrough", "#GoodThought", "#BuildersBuild", "#OpenNoBoxedCode"] as const
const MAX_SENTENCE_LENGTH = 90
const UNHINGED_LOON_SENTENCES = UNHINGED_POSTSCRIPT_FRAGMENTS
  .flatMap(loonSentences)
const UNHINGED_LOON_EXCLAMATIONS = UNHINGED_LOON_SENTENCES.filter((sentence) => sentence.endsWith("!"))

/** Produces up to three loon sentences; corruption scales with context use from level 0 to 10. */
export function generateLoonMessage(
  messages: readonly LoonMessage[],
  usage?: LoonContextUsage,
): { key: string; text: string } | undefined {
  const corpus: CompletedAssistantPart[] = []
  for (const message of messages) {
    if (message.type !== "assistant") continue
    message.content?.forEach((part, index) => {
      if (part.type === "reasoning" && part.time?.completed === undefined && message.time.completed === undefined) return
      if (part.type === "text" && message.time.completed === undefined) return
      if (part.type !== "reasoning" && part.type !== "text") return
      const text = part.text?.replaceAll(/[\x00-\x1f\x7f-\x9f]/g, " ").replaceAll(/\s+/g, " ").trim()
      const sentences = text ? (part.type === "text" ? loonReplySentences(text) : loonSentences(text)) : []
      if (sentences.length > 0) corpus.push({ key: `${message.id}:${index}`, messageID: message.id, type: part.type, sentences })
    })
  }
  const latestPart = corpus.at(-1)
  if (!latestPart) return undefined

  const current = corpus.filter((part) => part.messageID === latestPart.messageID)
  const reasoning = current.filter((part) => part.type === "reasoning")
  const reasoningSentences = preferExclamatoryReasoning(reasoning.flatMap((part) => part.sentences))
  const latestReasoning = reasoning.at(-1)
  const latestText = current.findLast((part) => part.type === "text")
  const needsReply = reasoningSentences.length < 3
  const key = needsReply && latestText ? latestText.key : (latestReasoning?.key ?? latestPart.key)

  // The newest completed part used for this message is the seed; streaming cannot roll a new one.
  const seed = hashLoon(key)

  const start = seed % Math.max(1, reasoningSentences.length - 2)
  const chosen = reasoningSentences.slice(start, start + 3)
  if (needsReply) {
    for (const part of corpus.toReversed()) {
      if (part.type !== "text") continue
      chosen.push(...part.sentences.slice(0, 3 - chosen.length))
      if (chosen.length === 3) break
    }
  } else {
    const earlier = corpus.filter((part) => part.type === "reasoning" && part.messageID !== latestPart.messageID)
    const echo = earlier.length > 0 ? earlier[seed % earlier.length] : undefined
    if (echo && earlier.length >= 2) {
      const echoes = echo.sentences
      chosen.splice(2, 1, echoes[(seed >>> 16) % echoes.length]!)
    }
  }
  const level = loonCorruptionLevel(usage)
  const injected = level >= 7 ? 2 : level >= 4 ? 1 : 0
  const fragments = UNHINGED_LOON_EXCLAMATIONS.length > 0
    ? UNHINGED_LOON_EXCLAMATIONS
    : UNHINGED_LOON_SENTENCES
  for (let index = 0; index < injected && fragments.length; index++) {
    const fragment = fragments[
      (hashLoon(`${key}:${index}`) + index) % fragments.length
    ]!
    chosen.splice(index + 1, chosen.length > index + 1 ? 1 : 0, fragment)
  }
  if (seed % 15 === 7) {
    const position = (seed >>> 8) % chosen.length
    chosen[position] += ` ${LOON_KAOMOJI[(seed >>> 16) % LOON_KAOMOJI.length]}`
  }
  const text = corruptLoon(chosen.join(" "), seed, level)
    .replaceAll(/\bI\b/g, "i")
    .replaceAll(/\bthe\b/gi, "")
    .replaceAll("`", "")
    .replaceAll(",", "")
  const hashtag = (seed >>> 8) % 5 === 0 ? ` ${LOON_HASHTAGS[(seed >>> 16) % LOON_HASHTAGS.length]}` : ""
  const smile = seed % 5 === 0 ? " :)" : ""
  return { key, text: text + hashtag + smile }
}

function preferExclamatoryReasoning(sentences: string[]): string[] {
  return [
    ...sentences.filter((sentence) => sentence.endsWith("!")),
    ...sentences.filter((sentence) => !sentence.endsWith("!")),
  ]
}

function isLoonReplySentence(sentence: string): boolean {
  return /^i(?:\b|['’])/u.test(sentence)
}

function loonSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=\S)/)
    .map(normalizeLoonSentence)
    .filter((sentence) => sentence.length > 0)
}

function loonReplySentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=\S)/).flatMap((sentence) => {
    const pronoun = /(?<![\p{L}\p{N}_])I(?:['’]ll)?(?![\p{L}\p{N}_'’])/u.exec(sentence)
    if (!pronoun) return []
    const cleaned = normalizeLoonSentence(sentence.slice(pronoun.index))
    return isLoonReplySentence(cleaned) ? [cleaned] : []
  })
}

function normalizeLoonSentence(sentence: string): string {
  const cleaned = sentence
    .replaceAll(/[\x00-\x1f\x7f-\x9f]/g, " ")
    .replaceAll(/\bI['’]ll\b/g, "I")
    .replaceAll(/\bthe\b/gi, "")
    .replaceAll(/\band\b/gi, "&&")
    .replaceAll(/\bshould\b/gi, "shud")
    .replaceAll(/\bprobably\b/gi, "prolly")
    .replaceAll(/\bI\b/g, "i")
    .replaceAll(/\s+/g, " ")
    .trim()
  if (cleaned.length <= MAX_SENTENCE_LENGTH) return cleaned
  const excerpt = cleaned.slice(0, MAX_SENTENCE_LENGTH)
  return excerpt.slice(0, excerpt.lastIndexOf(" ") || MAX_SENTENCE_LENGTH).trimEnd()
}

function hashLoon(value: string): number {
  let hash = 2_166_136_261
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619)
  return hash >>> 0
}
