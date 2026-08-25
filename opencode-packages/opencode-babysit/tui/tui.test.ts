import { expect, test } from "bun:test"
import babysitTuiPlugin from "./tui.js"

type StartedEvent = {
  location: { directory: string; workspaceID?: string }
  data: { sessionID: string }
}

test("babysit TUI opens and focuses started sessions from its location", () => {
  let started: ((event: StartedEvent) => void) | undefined
  const opened: string[] = []
  const focused: string[] = []
  const context = {
    location: { directory: "/workspace/repo", workspaceID: "workspace-a" },
    client: {
      rpc: () => ({
        events: {
          on: (_name: string, callback: (event: StartedEvent) => void) => {
            started = callback
            return () => undefined
          },
        },
      }),
    },
    ui: {
      tabs: {
        enabled: () => true,
        open: (sessionID: string) => opened.push(sessionID),
        focus: (sessionID: string) => focused.push(sessionID),
      },
    },
  } as unknown as Parameters<typeof babysitTuiPlugin.setup>[0]

  babysitTuiPlugin.setup(context)
  started?.({ location: { directory: "/other/repo", workspaceID: "workspace-a" }, data: { sessionID: "ses_other" } })
  started?.({ location: { directory: "/workspace/repo", workspaceID: "workspace-b" }, data: { sessionID: "ses_other_workspace" } })
  started?.({ location: { directory: "/workspace/repo", workspaceID: "workspace-a" }, data: { sessionID: "ses_babysitter" } })

  expect(opened).toEqual(["ses_babysitter"])
  expect(focused).toEqual(["ses_babysitter"])
})

test("babysit TUI navigates to the session when tabs are disabled", () => {
  let started: ((event: StartedEvent) => void) | undefined
  const routes: unknown[] = []
  const context = {
    location: { directory: "/workspace/repo", workspaceID: "workspace-a" },
    client: {
      rpc: () => ({
        events: {
          on: (_name: string, callback: (event: StartedEvent) => void) => {
            started = callback
            return () => undefined
          },
        },
      }),
    },
    ui: {
      tabs: { enabled: () => false },
      router: { navigate: (route: unknown) => routes.push(route) },
    },
  } as unknown as Parameters<typeof babysitTuiPlugin.setup>[0]

  babysitTuiPlugin.setup(context)
  started?.({ location: { directory: "/workspace/repo", workspaceID: "workspace-b" }, data: { sessionID: "ses_other_workspace" } })
  started?.({ location: { directory: "/workspace/repo", workspaceID: "workspace-a" }, data: { sessionID: "ses_babysitter" } })

  expect(routes).toEqual([{ type: "session", sessionID: "ses_babysitter" }])
})
