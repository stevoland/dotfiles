import { spawn } from "node:child_process"
import { Plugin } from "@opencode/plugin/tui"
import { lastAssistantMessageText, watchFeedbackFile } from "./feedback-editor"

export default Plugin.define({
  id: "stevo.feedback.tui",
  setup(context) {
    const editors = new Map<string, Awaited<ReturnType<typeof watchFeedbackFile>>>()
    const showError = (error: unknown) => context.ui.toast.show({
      title: "Feedback failed",
      message: error instanceof Error ? error.message : String(error),
      variant: "error",
    })

    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "stevo.feedback",
        title: "Edit the last assistant message as feedback",
        palette: true,
        slash: { name: "feedback" },
        enabled: () => context.ui.router.current().type === "session",
        async run() {
          const route = context.ui.router.current()
          if (route.type !== "session") return
          const sessionID = route.sessionID
          try {
            await context.data.session.message.sync(sessionID)
            const original = lastAssistantMessageText(context.data.session.message.list(sessionID))
            await editors.get(sessionID)?.close()
            const editor = await watchFeedbackFile({
              original,
              async submit(text) {
                await context.client.session.prompt({ sessionID, text })
              },
              onError: showError,
            })
            editors.set(sessionID, editor)
            context.renderer.suspend()
            try {
              await new Promise<void>((resolve, reject) => {
                const child = spawn("sh", ["-c", 'exec ${VISUAL:-${EDITOR:?Set VISUAL or EDITOR}} "$1"', "feedback", editor.file], {
                  cwd: context.location?.directory ?? context.data.location.default().directory,
                  stdio: "inherit",
                })
                child.once("error", reject)
                child.once("exit", (code, signal) => {
                  if (code === 0) resolve()
                  else reject(new Error(`Feedback: editor exited with ${signal ?? code}`))
                })
              })
            } finally {
              context.renderer.resume()
              context.renderer.requestRender()
            }
          } catch (error) {
            await editors.get(sessionID)?.close()
            editors.delete(sessionID)
            showError(error)
          }
        },
      }],
    }))

    return async () => {
      await Promise.all([...editors.values()].map((editor) => editor.close()))
    }
  },
})
