import { Plugin } from "@opencode/plugin/tui"

import { MdRpc } from "./rpc"

export default Plugin.define({
  id: "stevo.md.tui",
  setup(context) {
    const rpc = context.client.rpc(MdRpc)

    return rpc.events.on("written", (event) => {
      context.ui.toast.show({
        title: "Markdown handoff written",
        message: event.data.path,
        variant: "success",
      })
    })
  },
})
