import { spawn } from "node:child_process"

import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "stevo.zed",
  async setup(ctx) {
    await ctx.command.transform((editor) =>
      editor.add({
        name: "zed",
        description: "Open a file or workspace in Zed",
        execute: async ({ prompt }) => {
          const path = prompt.text.trim() || ctx.location.directory
          const process = spawn("zed", [path], {
            cwd: ctx.location.directory,
            detached: true,
            stdio: "ignore",
          })

          await new Promise<void>((resolve, reject) => {
            process.once("error", reject)
            process.once("spawn", () => {
              process.unref()
              resolve()
            })
          })
        },
      }),
    )
  },
})
