import { describe, expect, test } from "bun:test"

import { generateLoonMessage, type LoonMessage } from "./loon"
import { corruptLoon } from "./loon-corruption"
import { UNHINGED_POSTSCRIPT_FRAGMENTS } from "./unhinged-postscript-fragments"

const assistant = (id: string, text: string, completed?: number, partCompleted?: number): LoonMessage => ({
  id,
  type: "assistant",
  time: { completed },
  content: [{ type: "reasoning", text, time: partCompleted ? { completed: partCompleted } : undefined }],
})

const reply = (id: string, text: string, completed?: number): LoonMessage => ({
  id,
  type: "assistant",
  time: { completed },
  content: [{ type: "text", text }],
})

describe("loon", () => {
  test("keeps 30 distinct exclamation fragments for high-context messages", () => {
    expect(UNHINGED_POSTSCRIPT_FRAGMENTS).toHaveLength(30)
    expect(new Set(UNHINGED_POSTSCRIPT_FRAGMENTS).size).toBe(30)
    expect(UNHINGED_POSTSCRIPT_FRAGMENTS.every((fragment) => fragment.endsWith("!"))).toBe(true)
    expect(UNHINGED_POSTSCRIPT_FRAGMENTS.every((fragment) => fragment.length <= 90)).toBe(true)
  })

  test("stays empty without completed assistant reasoning or replies", () => {
    expect(generateLoonMessage([])).toBeUndefined()
    expect(generateLoonMessage([assistant("a", "still streaming")])).toBeUndefined()
    expect(generateLoonMessage([reply("b", "still streaming")])).toBeUndefined()
    expect(generateLoonMessage([{ id: "u", type: "u", time: {}, content: [{ type: "reasoning", text: "ignored" }] }])).toBeUndefined()
  })

  test("uses completed assistant replies when there is no reasoning", () => {
    const first = generateLoonMessage([reply("one", "I found an answer.", 1)])
    expect(first?.key).toBe("one:0")
    expect(first).toEqual(generateLoonMessage([reply("one", "I found an answer.", 1)]))
    expect(generateLoonMessage([reply("one", "I found an answer.", 1), reply("two", "I am still streaming")])).toEqual(first)
    expect(generateLoonMessage([reply("one", "I found an answer.", 1), reply("two", "I wrote a new reply.", 2)])?.key).toBe("two:0")
  })

  test("prefers exclamatory reasoning", () => {
    const message = assistant(
      "exclamatory",
      "I hold a quiet thought. I celebrate the result! I keep the next step ready. I finish with confidence!",
      1,
    )
    const output = generateLoonMessage([message])!.text
    expect(output).toContain("!")
    expect(output).not.toContain("this seems important")
  })

  test("injects authored fragments without an I prefix and keeps their opening words", () => {
    const outputs = Array.from({ length: 100 }, (_, index) =>
      generateLoonMessage(
        [assistant(`authored-${index}`, "I wait.", 1)],
        { tokens: 28_000, limit: 100_000, output: 10_000 },
      )!.text.replaceAll(/\s+/g, " "),
    )
    expect(outputs.some((output) => output.includes("Someone") && output.includes("tokens"))).toBe(true)
    expect(outputs.some((output) => output.includes("My build") && output.includes("bigger bowl"))).toBe(true)
  })

  test("fills sparse reasoning with completed reply sentences, but not tool or u text", () => {
    const mixed: LoonMessage = {
      id: "blend",
      type: "assistant",
      time: { completed: 3 },
      content: [
        { type: "reasoning", text: "I have one thought." },
        { type: "text", text: "I'll give first answer. I have second answer. Third answer." },
        { type: "tool", text: "Secret tool output." },
      ],
    }
    const result = generateLoonMessage([mixed, { id: "u", type: "u", time: {}, content: [{ type: "text", text: "u text." }] }])
    expect(result?.key).toBe("blend:1")
    expect(result?.text.replaceAll(/\p{M}/gu, "")).toMatch(/thought/i)
    expect(result?.text).not.toMatch(/secret|u text/i)
    expect(result?.text.match(/[.!?]+(?:\s|$)/g)?.length ?? 0).toBeGreaterThan(0)
    expect(result?.text.match(/[.!?]+(?:\s|$)/g)?.length ?? 0).toBeLessThanOrEqual(3)
  })

  test("uses completed replies from an earlier message until the current assistant reply completes", () => {
    const old = reply("previous", "I wrote a previous assistant reply.", 1)
    const reasoning = assistant("current", "I have one new thought.", undefined, 2)
    const result = generateLoonMessage([old, reasoning])
    expect(result?.key).toBe("current:0")
    expect(result?.text.match(/[.!?]+(?:\s|$)/g)?.length ?? 0).toBeLessThanOrEqual(3)
    expect(generateLoonMessage([old, reasoning, reply("next", "I wrote new text.", 3)])?.key).toBe("next:0")
  })

  test("prefers sufficient completed reasoning over the assistant reply", () => {
    const complete: LoonMessage = {
      id: "full",
      type: "assistant",
      time: { completed: 2 },
      content: [
        { type: "reasoning", text: "I have first thought. I'll try second thought. I have third thought." },
        { type: "text", text: "I said reply shud stay out." },
      ],
    }
    expect(generateLoonMessage([complete])?.key).toBe("full:0")
    expect(generateLoonMessage([complete])?.text).not.toContain("Assistant reply")
  })

  test("does not change while the next reasoning part streams", () => {
    const done = assistant("a", "I have an original plan that is holding steady.", 1)
    const streaming = assistant("b", "I am thinking")
    const before = generateLoonMessage([done])
    expect(generateLoonMessage([done, streaming])).toEqual(before)
    expect(generateLoonMessage([done, assistant("b", "I am thinking much longer and harder")])).toEqual(before)
    expect(generateLoonMessage([done, assistant("b", "I am thinking much longer and harder", undefined, 2)])?.key).toBe("b:0")
  })

  test("uses message completion when the part lacks its own timestamp", () => {
    const output = generateLoonMessage([assistant("a", "I saw a summary from the model", 1)])
    expect(output?.text.replaceAll(/\p{M}/gu, "").toLowerCase()).toContain("summary")
  })

  test("advances for each completed part, not for unfinished parts in the same message", () => {
    const message: LoonMessage = {
      id: "a",
      type: "assistant",
      time: {},
      content: [
        { type: "reasoning", text: "I have first thought", time: { completed: 1 } },
        { type: "reasoning", text: "I'll think again" },
      ],
    }
    expect(generateLoonMessage([message])?.key).toBe("a:0")
    const completed: LoonMessage = {
      ...message,
      content: [message.content![0]!, { type: "reasoning", text: "I'll think again", time: { completed: 2 } }],
    }
    expect(generateLoonMessage([completed])?.key).toBe("a:1")
  })

  test("produces the same bounded message from the same cached corpus", () => {
    const messages = [
      assistant("a", "I check the session cache before reading reasoning summaries.", 1),
      assistant("b", "I shape the cached summaries without changing during streaming.", 2),
      assistant("c", "I compose the fragments and let the words start slipping out of place.", 3),
      assistant("d", "I hold the session stable until another piece of reasoning finishes.", 4),
    ]
    const first = generateLoonMessage(messages)
    expect(first).toEqual(generateLoonMessage(messages))
    expect(first!.text.length).toBeLessThanOrEqual(300)
  })

  test("increases decay with context use and preserves text rules", () => {
    const messages = [assistant("context-level", "I have one thought and the other thought. I will continue.", 1)]
    const clean = generateLoonMessage(messages, { tokens: 0, limit: 100_000, output: 10_000 })
    const early = generateLoonMessage(messages, { tokens: 7_000, limit: 100_000, output: 10_000 })
    const interleaved = generateLoonMessage(messages, { tokens: 28_000, limit: 100_000, output: 10_000 })
    const maximum = generateLoonMessage(messages, { tokens: 70_000, limit: 100_000, output: 10_000 })
    expect(clean?.text).toContain("i have one thought && other thought.")
    expect(early?.text).not.toBe(clean?.text)
    expect(interleaved?.text).not.toBe(early?.text)
    expect(maximum).toEqual(generateLoonMessage(messages, { tokens: 70_000, limit: 100_000, output: 10_000 }))
    expect(maximum?.text).not.toBe(interleaved?.text)
    expect(maximum?.text).not.toMatch(/,|\bthe\b/i)
    expect(maximum?.text).not.toMatch(/\bI\b/)
    expect(maximum?.text.match(/[.!?]+(?:\s|$)/g)?.length ?? 0).toBeLessThanOrEqual(3)
  })

  test("doubles or triples exclamation marks and adds smiles to roughly 20% of messages", () => {
    const outputs = Array.from({ length: 100 }, (_, index) =>
      generateLoonMessage(
        [assistant(`smile-${index}`, "I celebrate every milestone! I keep going!", 1)],
        { tokens: 70_000, limit: 100_000, output: 10_000 },
      )!.text,
    )
    const exclamationRuns = outputs.flatMap((output) => output.match(/!+/g) ?? [])
    expect(exclamationRuns.length).toBeGreaterThan(0)
    expect(exclamationRuns.every((run) => run.length === 2 || run.length === 3)).toBe(true)
    const smiles = outputs.filter((output) => output.endsWith(":)"))
    expect(smiles.length).toBeGreaterThanOrEqual(10)
    expect(smiles.length).toBeLessThanOrEqual(30)
  })

  test("adds Zalgo to more words at each level from level 4", () => {
    const source = "A lowercase A lowercase A lowercase A lowercase"
    const markCount = (text: string) => [...text].filter((character) => /\p{M}/u.test(character)).length
    const level3 = markCount(corruptLoon(source, 123, 3))
    const level4 = markCount(corruptLoon(source, 123, 4))
    const level5 = markCount(corruptLoon(source, 123, 5))
    const level6 = markCount(corruptLoon(source, 123, 6))
    expect(level3).toBe(0)
    expect(level4).toBeGreaterThan(level3)
    expect(level5).toBeGreaterThan(level4)
    expect(level6).toBeGreaterThan(level5)
    expect(corruptLoon(source, 123, 5)).toBe(corruptLoon(source, 123, 5))
    const markedWords = corruptLoon("lower A lower A", 123, 4).split(/\s+/).filter((word) => /\p{M}/u.test(word))
    expect(markedWords).toHaveLength(1)
    expect(markedWords[0]!.replace(/[\p{M}ꙮ⸸]/gu, "")).toBe("A")
  })

  test("inserts ꙮ and ⸸ more frequently from level 3", () => {
    const source = "First sentence. Second sentence. Third sentence."
    const symbolCount = (text: string) => (text.match(/[ꙮ⸸]/g) ?? []).length
    const level2 = symbolCount(corruptLoon(source, 456, 2))
    const level3 = symbolCount(corruptLoon(source, 456, 3))
    const level4 = symbolCount(corruptLoon(source, 456, 4))
    const level5 = symbolCount(corruptLoon(source, 456, 5))
    expect(level2).toBe(0)
    expect(level3).toBeGreaterThan(level2)
    expect(level4).toBeGreaterThan(level3)
    expect(level5).toBeGreaterThan(level4)
    expect(corruptLoon(source, 456, 3)).toMatch(/\.\sꙮ\s/)
    expect(corruptLoon(source, 456, 4)).toMatch(/\.\sꙮ ⸸\s/)
    expect(corruptLoon(source, 456, 5)).toMatch(/\.\sꙮ ⸸ ꙮ\s/)
  })

  test("keeps terminal control characters out of the displayed text", () => {
    expect(generateLoonMessage([assistant("a", "I keep safe\u001b[31m text\nonly", 1)])?.text).not.toMatch(/[\x00-\x1f\x7f-\x9f]/)
  })

  test("selects at most three complete sentences from reasoning summaries", () => {
    const source = "I have first idea. I'll try second idea. I have third idea. I have fourth idea. I have fifth idea."
    const messages = Array.from({ length: 30 }, (_, index) => assistant(`sentence-${index}`, source, 1))
    for (const message of messages) {
      const output = generateLoonMessage([message])!.text
      expect(output.match(/[.!?]+(?:\s|$)/g)?.length ?? 0).toBeLessThanOrEqual(3)
    }
  })

  test("filters only assistant replies for standalone I or I'll and strips earlier words", () => {
    expect(generateLoonMessage([reply("none", "A model answers. I'm still here. AI can help.", 1)])).toBeUndefined()
    const result = generateLoonMessage([reply("first-person", "No pronoun here. Ignore this prefix: I'll take the path. I see another route.", 1)])
    expect(result?.text).not.toMatch(/no pronoun|ignore this prefix/i)
    expect(result?.text).not.toMatch(/\bI'll\b|\bI\b/)
  })

  test("keeps reasoning sentences without I and preserves words before a pronoun", () => {
    const result = generateLoonMessage([
      assistant("reasoning-prefix", "My context window should probably close! Before I act: check the build.", 1),
    ])
    expect(result?.key).toBe("reasoning-prefix:0")
    expect(result?.text).toContain("My context window shud prolly close!")
    expect(result?.text).toContain("Before i act: check build.")
    expect(generateLoonMessage([reply("reply-prefix", "My context window should probably close!", 1)])).toBeUndefined()
  })

  test("normalizes and to &&, drops the, and keeps every I lowercase", () => {
    const output = generateLoonMessage([assistant("rewrite", "Before I arrive: I'll take the map and the key. I inspect The map and the door.", 1)])!.text
    expect(output).toContain("&&")
    expect(output).not.toMatch(/\b(?:I'll|I|and)\b/)
    expect(output).not.toMatch(/\bthe\b/i)
    expect(output).toContain("Before i arrive:")
    expect(output).toMatch(/\bi\b/)
  })

  test("removes commas from generated messages", () => {
    const output = generateLoonMessage([assistant("commas", "I think, then I act, and I'll continue, carefully.", 1)])!.text
    expect(output).not.toContain(",")
    expect(output).not.toContain("`")
    expect(output).toContain("&&")
  })

  test("replaces should and probably as whole words in reasoning and fallback replies", () => {
    const source = "I should probably continue. I SHOULD PROBABLY wait. I keep shoulders probablyish."
    for (const message of [assistant("spellings", source, 1), reply("spellings", source, 1)]) {
      const output = generateLoonMessage([message])!.text
      expect(output).toContain("i shud prolly continue.")
      expect(output).toContain("i shud prolly wait.")
      expect(output).toContain("shoulders probablyish")
      expect(output).not.toMatch(/\b(?:should|probably)\b/i)
    }
  })

  test("keeps generated text valid when the source has no and", () => {
    const messages = Array.from({ length: 18 }, (_, index) => assistant(`no-conjunction-${index}`, "I keep only these words. I speak again. I continue.", 1))
    for (const message of messages) {
      const output = generateLoonMessage([...messages.slice(0, 17), message], { tokens: 21_000, limit: 100_000, output: 10_000 })!.text
      expect(output).not.toMatch(/\bI\b/)
      expect(output.length).toBeGreaterThan(0)
    }
  })

  test("ignores a newer completed assistant part with no eligible sentence", () => {
    const previous = assistant("eligible", "I can use this sentence.", 1)
    const result = generateLoonMessage([previous])
    expect(generateLoonMessage([previous, reply("ineligible", "Here is a reply without the pronoun.", 2)])).toEqual(result)
  })

  test("occasionally inserts kaomoji into prose and appends seeded hashtags", () => {
    const outputs = Array.from({ length: 120 }, (_, index) =>
      generateLoonMessage([assistant(`interlude-${index}`, "I read reasoning summaries and I feed words.", 1)])!.text,
    )
    const kaomoji = [
      "(´；ω；`)ノ", "༼ ↂڡↂ ༽つ⌫", "(◕‿◕)", "(╯°□°)╯︵ ┻━┻",
      "¯\\_(ツ)_/¯", "(ಥ﹏ಥ)", "ლ(ಠ益ಠლ)", "(っ˘̩╭╮˘̩)っ",
    ]
    const kaomojiMarkers = ["(´", "༼", "(◕", "(╯", "¯\\", "(ಥ", "ლ(", "(っ"]
    expect(outputs.some((output) => kaomojiMarkers.some((marker) => output.includes(marker)))).toBe(true)
    expect(outputs.every((output) => !kaomoji.includes(output))).toBe(true)
    expect(outputs.some((output) => /#[a-z]+$/.test(output))).toBe(true)
    expect(outputs.some((output) => !output.includes("#"))).toBe(true)
  })
})
