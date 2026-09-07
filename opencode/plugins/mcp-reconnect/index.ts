import { spawn } from "node:child_process"

import { Plugin } from "@opencode/plugin"

const retryDelays = [1_000, 5_000, 15_000]

export default Plugin.define({
  id: "stevo.mcp-reconnect",
  setup(ctx) {
    const abort = new AbortController()
    const active = new Set<string>()

    const watch = async () => {
      for await (const event of ctx.event.subscribe({ signal: abort.signal })) {
        if (event.type === "mcp.status.changed") {
          if (event.location?.directory === ctx.location.directory) {
            if (active.has(event.data.server)) continue

            active.add(event.data.server)
            void reconnect(event.data.server).then(
              () => active.delete(event.data.server),
              (error) => {
                active.delete(event.data.server)
                if (abort.signal.aborted) return
                console.error("MCP reconnect failed", error)
              },
            )
          }
        }
      }
    }

    void watch().then(undefined, (error) => {
      if (abort.signal.aborted) return
      console.error("MCP reconnect listener failed", error)
    })

    return () => abort.abort()

    async function reconnect(name: string) {
      for (const delay of retryDelays) {
        await wait(delay)

        const servers = await ctx.mcp.list({ location: { directory: ctx.location.directory } })
        const server = servers.data.find((entry) => entry.name === name)
        if (server === undefined) return
        if (server.status.status === "failed") {
          const path = `/api/experimental/mcp/${encodeURIComponent(name)}/connect?${new URLSearchParams({
            "location[directory]": ctx.location.directory,
          })}`
          const process = spawn("opencode2", ["api", "post", path], {
            stdio: "ignore",
          })
          await new Promise<void>((resolve, reject) => {
            process.once("error", reject)
            process.once("close", () => resolve())
          })
          continue
        }
        return
      }
    }
  },
})

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}
