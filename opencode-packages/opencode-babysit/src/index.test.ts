import { expect, test } from "bun:test"
import babysitPlugin from "./index.js"

test("opencode-babysit registers the server command and direct model tool", async () => {
  const commands: Array<{ name: string }> = []
  const tools: Array<{ name: string; options?: { codemode?: boolean } }> = []
  const context = {
    rpc: {
      register: async () => ({ events: { emit: async () => undefined } }),
    },
    session: {
      hook: async () => undefined,
    },
    command: {
      transform: async (register: (editor: { add: (command: { name: string }) => void }) => void) => {
        register({ add: (command) => commands.push(command) })
      },
    },
    tool: {
      transform: async (
        register: (editor: {
          add: (tool: { name: string; options?: { codemode?: boolean } }) => void
        }) => void,
      ) => {
        register({ add: (tool) => tools.push(tool) })
      },
    },
  } as unknown as Parameters<typeof babysitPlugin.setup>[0]

  await babysitPlugin.setup(context)

  expect(commands.map((command) => command.name)).toEqual(["babysit"])
  expect(tools.map((tool) => ({ name: tool.name, codemode: tool.options?.codemode }))).toEqual([
    { name: "babysit", codemode: false },
  ])
})

test("opencode-babysit hides its starter tool from babysitters and child sessions", async () => {
  type ContextEvent = { sessionID: string; agent: string; tools: Record<string, unknown> }
  let contextHook: ((event: ContextEvent) => Promise<void> | void) | undefined
  const context = {
    rpc: {
      register: async () => ({ events: { emit: async () => undefined } }),
    },
    session: {
      hook: async (_name: string, callback: (event: ContextEvent) => Promise<void> | void) => {
        contextHook = callback
      },
      get: async ({ sessionID }: { sessionID: string }) =>
        sessionID === "ses_child"
          ? { id: sessionID, parentID: "ses_parent" }
          : { id: sessionID },
    },
    command: { transform: async () => undefined },
    tool: { transform: async () => undefined },
  } as unknown as Parameters<typeof babysitPlugin.setup>[0]

  await babysitPlugin.setup(context)
  expect(contextHook).toBeDefined()

  const babysitter = { sessionID: "ses_babysitter", agent: "babysitter", tools: { babysit: {} } }
  const child = { sessionID: "ses_child", agent: "general", tools: { babysit: {} } }
  const main = { sessionID: "ses_main", agent: "low", tools: { babysit: {} } }
  await contextHook!(babysitter)
  await contextHook!(child)
  await contextHook!(main)

  expect(babysitter.tools).not.toHaveProperty("babysit")
  expect(child.tools).not.toHaveProperty("babysit")
  expect(main.tools).toHaveProperty("babysit")
})
