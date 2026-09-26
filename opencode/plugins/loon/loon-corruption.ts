import { zalgoGeneration } from "zalgo-generator"

/** Applies seeded decay to one loon message; level 5+ doubles or triples exclamation marks. */
export function corruptLoon(text: string, seed: number, level: number): string {
  if (level <= 0) return text
  const words = text.split(" ")
  const count = (start: number, step: number, max: number) => level < start ? 0 : Math.min(max, 1 + Math.floor((level - start) / step))

  for (let index = 0; index < count(1, 3, 4); index++) mutateWord(words, seed, 10 + index, doubleLetter)
  for (let index = 0; index < count(3, 3, 3); index++) mutateWord(words, seed, 30 + index, transposeLetters)
  for (let index = 0; index < count(4, 3, 3); index++) slipWordBoundary(words, seed, 50 + index)
  for (let index = 0; index < count(5, 2, 3); index++) mutateWord(words, seed, 70 + index, insertSemicolon)
  for (let index = 0; index < count(6, 3, 2); index++) mutateWord(words, seed, 90 + index, shoutWord)

  const spaceChance = level < 2 ? 0 : level < 7 ? 0.08 + level * 0.025 : 0.2 + (level - 7) * 0.09
  const corrupted = words.map((word, index) => {
    if (index === words.length - 1) return word
    const extra = randomUnit(seed, 110 + index) < spaceChance ? 1 + (hashLoonSalt(seed, 140 + index) % Math.max(1, Math.ceil(level / 3))) : 0
    return word + " ".repeat(1 + extra)
  }).join("")
  const amplified = level < 5
    ? corrupted
    : corrupted.replaceAll(/!/g, (_, offset: number) => "!".repeat(2 + (hashLoonSalt(seed, 170 + offset) % 2)))
  const withZalgo = level < 4 ? amplified : addZalgoToWords(amplified, seed, level)
  return level < 3 ? withZalgo : insertObscureSymbols(withZalgo, level)
}

function insertObscureSymbols(text: string, level: number): string {
  const count = level - 2
  if (count <= 0) return text
  const symbols = Array.from({ length: count }, (_, index) => index % 2 === 0 ? "ꙮ" : "⸸").join(" ")
  return text.replace(/([.!?]+)(\s+)(?=\S)/, `$1 ${symbols} `)
}

function addZalgoToWords(text: string, seed: number, level: number): string {
  const capitalizedWordPattern = /(?<![\p{L}\p{N}_])\p{Lu}[\p{L}]*(?![\p{L}\p{N}_])/gu
  const matches = [...text.matchAll(capitalizedWordPattern)]
  const seenWords = new Set<string>()
  // Only later occurrences qualify; the first capitalized occurrence stays clean.
  const repeatedWordIndexes = matches.flatMap((match, index) => {
    const word = match[0]!
    if (seenWords.has(word)) {
      return [index]
    }
    seenWords.add(word)
    return []
  })
  const count = Math.min(level - 3, repeatedWordIndexes.length)
  if (count <= 0) return text
  const selected = new Set<number>()
  for (let index = 0; selected.size < count; index++) {
    selected.add(repeatedWordIndexes[hashLoonSalt(seed, 200 + index) % repeatedWordIndexes.length]!)
  }
  let wordIndex = 0
  return text.replace(capitalizedWordPattern, (word) => {
    const selectedWord = selected.has(wordIndex++)
    return selectedWord ? deterministicZalgoGeneration(word, seed, wordIndex) : word
  })
}

function deterministicZalgoGeneration(word: string, seed: number, wordIndex: number): string {
  // zalgo-generator uses Math.random internally; seed it temporarily to preserve loon stability.
  const originalRandom = Math.random
  let randomIndex = 0
  Math.random = () => {
    const value = hashLoonSalt(seed, 300 + wordIndex * 100 + randomIndex++)
    return value / 4_294_967_296
  }
  try {
    return zalgoGeneration(word, 0, 0, 1)
  } finally {
    Math.random = originalRandom
  }
}

function mutateWord(words: string[], seed: number, salt: number, mutation: (word: string, seed: number) => string): void {
  const candidates = words.map((word, index) => /[a-zA-Z]{3,}/.test(word) ? index : -1).filter((index) => index >= 0)
  if (!candidates.length) return
  const index = candidates[hashLoonSalt(seed, salt) % candidates.length]!
  words[index] = mutation(words[index]!, hashLoonSalt(seed, salt + 1))
}

function doubleLetter(word: string, seed: number): string {
  const positions = [...word.matchAll(/[a-zA-Z]/g)].map((match) => match.index)
  const index = positions[seed % positions.length]!
  return word.slice(0, index) + word[index] + word.slice(index)
}

function transposeLetters(word: string, seed: number): string {
  const positions = [...word.matchAll(/(?=([a-zA-Z])([a-zA-Z]))/g)]
    .filter((match) => match[1] !== match[2]).map((match) => match.index)
  if (!positions.length) return word
  const index = positions[seed % positions.length]!
  return word.slice(0, index) + word[index + 1] + word[index] + word.slice(index + 2)
}

function insertSemicolon(word: string, seed: number): string {
  const positions = [...word.matchAll(/(?<=[a-zA-Z])(?=[a-zA-Z])/g)].map((match) => match.index)
  if (!positions.length) return word
  const index = positions[seed % positions.length]!
  return word.slice(0, index) + ";" + word.slice(index)
}

function shoutWord(word: string): string {
  return word.toUpperCase()
}

function slipWordBoundary(words: string[], seed: number, salt: number): void {
  const positions = words.slice(0, -1).map((word, index) =>
    /[a-zA-Z]{2}$/.test(word) && /^[a-zA-Z]{2}/.test(words[index + 1]!) ? index : -1,
  ).filter((index) => index >= 0)
  if (!positions.length) return
  const index = positions[hashLoonSalt(seed, salt) % positions.length]!
  if (hashLoonSalt(seed, salt + 1) % 2) {
    words[index + 1] = words[index]!.slice(-1) + words[index + 1]
    words[index] = words[index]!.slice(0, -1)
  } else {
    words[index] += words[index + 1]![0]
    words[index + 1] = words[index + 1]!.slice(1)
  }
}

function randomUnit(seed: number, salt: number): number {
  return hashLoonSalt(seed, salt) / 4_294_967_296
}

function hashLoonSalt(seed: number, salt: number): number {
  let hash = (seed ^ Math.imul(salt + 1, 2_654_435_761)) >>> 0
  hash ^= hash >>> 16
  hash = Math.imul(hash, 2_246_822_507) >>> 0
  hash ^= hash >>> 13
  return hash >>> 0
}
