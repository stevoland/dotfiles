import { Plugin } from "@opencode-ai/plugin/tui"
import { BabysitRpc } from "../src/babysit-rpc.js"

/** Opens newly started babysitter sessions in the active OpenCode TUI. */
export default Plugin.define({
  id: "opencode-babysit.tui",
  setup(context) {
    const babysit = context.client.rpc(BabysitRpc)
    return babysit.events.on("started", (event) => {
      const location = context.location ?? context.data.location.default()
      if (
        event.location.directory !== location.directory ||
        event.location.workspaceID !== location.workspaceID
      ) {
        return
      }

      const { sessionID } = event.data as { sessionID: string }
      if (!context.ui.tabs.enabled()) {
        context.ui.router.navigate({ type: "session", sessionID })
        return
      }

      context.ui.tabs.open(sessionID)
      context.ui.tabs.focus(sessionID)
    })
  },
})
