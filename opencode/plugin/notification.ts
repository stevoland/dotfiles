import type { Plugin } from "@opencode-ai/plugin"
import { writeFile } from "node:fs/promises"

export const NotificationPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      // Send notification on session completion
      if (event.type === "session.idle") {
        const repoName = directory.split('/').at(-1)!
        await $`osascript -e 'display notification "Cooked ${repoName}" with title "opencode"'`

        // await client.tui.executeCommand({
        //   body: {
        //     command: "app_exit"
        //   }
        // })

        // await client.session.abort({
        //   path: {
        //     id: event.properties.sessionID,
        //   }
        // })
      }
    },
  }
}
