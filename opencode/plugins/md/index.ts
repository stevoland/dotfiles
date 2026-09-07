import { open } from "node:fs/promises"
import { extname, relative, resolve } from "node:path"

import { MdRpc } from "./rpc"

const DEFAULT_PATH = "plan.md"

export default {
  id: "stevo.md",
  async setup(ctx: any) {
    const rpc = await ctx.rpc.register(MdRpc, {})

    await ctx.command.transform((editor: any) => {
      editor.add({
        name: "md",
        description: "Write the last assistant message to a Markdown file",
        execute: async ({ sessionID, prompt }: any) => {
          const session = await ctx.session.get({ sessionID })
          const messages = await ctx.session.context({ sessionID })
          const assistant = [...messages].reverse().find((message) => message.type === "assistant")

          if (!assistant) {
            throw new Error("No assistant message found in the current session")
          }

          const text = assistant.content
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text)
            .join("")

          const requestedPath = prompt.text.trim() || DEFAULT_PATH
          const file = await createAvailableFile(session.location.directory, requestedPath)

          try {
            await file.handle.writeFile(text, "utf8")
          } finally {
            await file.handle.close()
          }

          await rpc.events.emit("written", {
            path: relative(session.location.directory, file.path),
          })
        },
      })
    })
  },
}

async function createAvailableFile(directory: string, requestedPath: string) {
  const target = resolve(directory, requestedPath)
  const extension = extname(target)
  const stem = extension ? target.slice(0, -extension.length) : target

  for (let suffix = 0; ; suffix++) {
    const candidate = suffix === 0 ? target : `${stem}-${suffix}${extension}`

    try {
      return { handle: await open(candidate, "wx"), path: candidate }
    } catch (error: any) {
      if (error.code !== "EEXIST") {
        throw error
      }
    }
  }
}
