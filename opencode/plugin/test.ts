import type { Plugin } from "@opencode-ai/plugin"

export const TestPlugin: Plugin = async ({ app, client, $ }) => {
  return {
    event: async ({ event }) => {
      // await $`echo "${event.type}" >> ./event.log`
    }
  }
}
