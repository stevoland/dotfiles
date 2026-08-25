import assert from "node:assert/strict"
import { Effect } from "effect"
import { defineScript, Llm, type OpenCode } from "opencode-drive"

const trajectoryPackage = process.cwd()
const prompt = "Describe the trajectory fixture"

const countAdmissions = (opencode: OpenCode, text: string) =>
  Effect.gen(function* () {
    const session = (yield* opencode.session.list({ limit: 1, order: "desc" })).data[0]
    if (!session) return 0
    const messages = yield* opencode.message.list({ sessionID: session.id, limit: 100, order: "desc" })
    return messages.data.filter((message) => message.type === "user" && message.text === text).length
  })

const countAllAdmissions = (opencode: OpenCode) =>
  Effect.gen(function* () {
    const session = (yield* opencode.session.list({ limit: 1, order: "desc" })).data[0]
    if (!session) return 0
    const messages = yield* opencode.message.list({ sessionID: session.id, limit: 100, order: "desc" })
    return messages.data.filter((message) => message.type === "user").length
  })

export default defineScript({
  config: { plugins: [`file:${trajectoryPackage}`] },
  tools: ["shell"],
  tui: { viewport: { cols: 120, rows: 36 } },
  run: ({ ui, llm, opencode, artifacts, tools }) =>
    Effect.gen(function* () {
      const location = yield* opencode.location.get({ location: { directory: `${artifacts}/files` } })
      yield* opencode.plugin.awaitActivation({ location })
      yield* llm.title(() => Effect.succeed("Trajectory fixture"))
      yield* llm.queue(Llm.reasoning("Inspecting the deterministic fixture."), Llm.text("TRAJECTORY_REPLY_OK"))

      yield* ui.submit(prompt)
      yield* ui.waitFor("TRAJECTORY_REPLY_OK")
      assert.equal(yield* countAdmissions(opencode, prompt), 1)

      const shells = yield* tools.control("shell")
      yield* llm.queue(
        Llm.toolCall({ index: 0, id: "call_trajectory_shell", name: "shell", input: { command: "fixture-only" } }),
        Llm.finish("tool-calls"),
      )
      yield* llm.queue(Llm.text("TRAJECTORY_TOOL_DONE"))
      yield* ui.submit("Run the trajectory fixture tool")
      const shell = yield* shells.take("call_trajectory_shell")
      yield* shell.succeed({ output: "TRAJECTORY_TOOL_OUTPUT", exit: 0 })
      yield* ui.waitFor("TRAJECTORY_TOOL_DONE")
      const admissionsBeforeTrajectory = yield* countAllAdmissions(opencode)

      yield* ui.submit("/trajectory")
      yield* ui.screenshot("trajectory-opened")
      yield* ui.waitFor("trajectory · Trajectory fixture")
      yield* ui.waitFor("Input")
      yield* ui.waitFor("Model")
      yield* ui.waitFor("shell")
      yield* ui.press("down")
      yield* ui.press("down")
      yield* ui.press("down")
      yield* ui.press("down")
      yield* ui.waitFor("TOOL · Turn 2 · Step 1")
      yield* ui.press("tab")
      yield* ui.waitFor("fixture-only")
      yield* ui.screenshot("trajectory-wide")

      yield* ui.resize({ cols: 68, rows: 28 })
      const narrowFrame = yield* ui.capture()
      assert.equal(narrowFrame.cols, 68)
      assert.equal(narrowFrame.rows, 28)
      yield* ui.waitFor("steps")
      yield* ui.press("return")
      yield* ui.waitFor("Summary")
      yield* ui.screenshot("trajectory-narrow-details")

      yield* ui.press("escape")
      yield* ui.waitFor("Turn 1")
      yield* ui.screenshot("trajectory-narrow")

      assert.equal(yield* countAllAdmissions(opencode), admissionsBeforeTrajectory)
      yield* ui.press("escape")
      yield* ui.waitFor("TRAJECTORY_REPLY_OK")
    }),
})
