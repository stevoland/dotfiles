/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode-ai/plugin/tui"
import { Show } from "solid-js"

import { TrajectoryPanel } from "./trajectory-panel.js"

const trajectoryPanelName = "opencode-trajectory.viewer"

/** Registers the `/trajectory` command and full-screen session trajectory panel. */
export default Plugin.define({
  id: "opencode-trajectory",
  setup(context) {
    context.ui.slot({
      append: "session.panel",
      render: (panel) => (
        <Show when={panel.name === trajectoryPanelName}>
          <TrajectoryPanel context={context} panel={panel} />
        </Show>
      ),
    })

    context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "trajectory.open",
              title: "Open session trajectory",
              description: "Inspect the current session's messages, model steps, and tool calls",
              group: "Session",
              palette: true,
              slash: { name: "trajectory" },
              run: () => {
                if (context.ui.panel.open(trajectoryPanelName, { presentation: "fullscreen" })) return
                context.ui.toast.show({
                  title: "Trajectory",
                  message: "Open a session before viewing its trajectory.",
                  variant: "warning",
                })
              },
            },
          ],
        }))
        return null
      },
    })
  },
})
