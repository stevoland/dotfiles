import { expect, test } from "bun:test"
import { rename, writeFile } from "node:fs/promises"
import type { SessionMessageInfo } from "@opencode/client"
import { lastAssistantMessageText, watchFeedbackFile } from "./feedback-editor"

test("feedback uses only the last assistant message's text", () => {
  const messages = [
    { type: "assistant", content: [{ type: "text", text: "Earlier answer" }] },
    { type: "user", text: "Try again" },
    { type: "assistant", content: [
      { type: "reasoning", text: "Private reasoning" },
      { type: "tool", name: "shell" },
      { type: "text", text: "Last " },
      { type: "text", text: "answer" },
    ] },
  ] as SessionMessageInfo[]
  expect(lastAssistantMessageText(messages)).toBe("Last answer")
  expect(() => lastAssistantMessageText([])).toThrow("no assistant message")
})

test("saving feedback sends a diff against the original, including atomic saves", async () => {
  const prompts: string[] = []
  const errors: unknown[] = []
  const editor = await watchFeedbackFile({
    original: "Original answer\n",
    submit: async (text) => { prompts.push(text) },
    onError: (error) => errors.push(error),
  })
  try {
    await writeFile(editor.file, "First correction\n")
    await waitForPrompts(prompts, 1, errors)
    expect(prompts[0]).toContain("-Original answer\n+First correction")
    expect(prompts[0]).toContain("This is the user's feedback")

    await writeFile(editor.file + ".new", "Second correction\n")
    await rename(editor.file + ".new", editor.file)
    await waitForPrompts(prompts, 2, errors)
    expect(prompts[1]).toContain("-Original answer\n+Second correction")
    expect(prompts[1]).not.toContain("First correction")

    await writeFile(editor.file, "Second correction\n")
    await Bun.sleep(250)
    expect(prompts).toHaveLength(2)
    expect(errors).toEqual([])
  } finally {
    await editor.close()
  }
})

async function waitForPrompts(prompts: string[], count: number, errors: unknown[]) {
  for (let attempt = 0; attempt < 100 && prompts.length < count; attempt++) {
    if (errors.length) throw errors[0]
    await Bun.sleep(20)
  }
  expect(prompts).toHaveLength(count)
}
