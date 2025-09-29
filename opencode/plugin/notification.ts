import type { Plugin } from "@opencode-ai/plugin"

export const NotificationPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      // Send notification on session completion
      if (event.type === "session.idle") {
        $`say cooked!`
        await $`osascript -e 'display notification "Cooked!" with title "opencode"'`
      }
    },
  }
}
