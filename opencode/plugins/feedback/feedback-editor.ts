import { execFile } from "node:child_process"
import { unwatchFile, watchFile } from "node:fs"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { SessionMessageInfo } from "@opencode/client"

/** Extracts only text from the last assistant message, never reasoning or tool calls. */
export function lastAssistantMessageText(messages: readonly SessionMessageInfo[]) {
  const assistant = [...messages].reverse().find((message) => message.type === "assistant")
  if (!assistant) throw new Error("Feedback: no assistant message in this session")
  const text = assistant.content.filter((part) => part.type === "text").map((part) => part.text).join("")
  if (!text) throw new Error("Feedback: the last assistant message has no text")
  return text
}

/** Watches a temporary Markdown file and sends feedback on each changed save. */
export async function watchFeedbackFile(input: {
  original: string
  submit: (text: string) => Promise<void>
  onError: (error: unknown) => void
}) {
  const directory = await mkdtemp(join(tmpdir(), "opencode-feedback-"))
  const originalFile = join(directory, "original.md")
  const file = join(directory, "feedback.md")
  await writeFile(originalFile, input.original, { mode: 0o600 })
  await writeFile(file, input.original, { mode: 0o600 })
  let previous = input.original
  let pending = Promise.resolve()
  let closed = false

  // Poll the path so editor saves that replace the file keep being watched.
  const onSave = () => {
    if (closed) return
    pending = pending.then(async () => {
      if (closed) return
      const edited = await readFile(file, "utf8")
      if (edited === previous) return
      const patch = await createFeedbackDiff(originalFile, file)
      if (closed) return
      if (patch) {
        await input.submit(
          "This is the user's feedback as a diff from your last assistant message. " +
          "Use it to revise your answer or continue the task; this is not a repository patch.\n\n" +
          "```diff\n" + patch + "```",
        )
      }
      previous = edited
    }).catch(input.onError)
  }
  watchFile(file, { interval: 100 }, onSave)

  return {
    file,
    async close() {
      closed = true
      unwatchFile(file, onSave)
      await pending
      await rm(directory, { recursive: true, force: true })
    },
  }
}

function createFeedbackDiff(originalFile: string, editedFile: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("diff", ["-u", "--label", "assistant-message", "--label", "user-feedback", originalFile, editedFile],
      { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
        if (error && error.code !== 1) return reject(error)
        resolve(stdout)
      })
  })
}
