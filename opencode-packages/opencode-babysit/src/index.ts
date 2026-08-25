import { Plugin } from "@opencode-ai/plugin"
import { BabysitRpc } from "./babysit-rpc.js"
import { verifyGitHubPullRequest } from "./github-pull-request.js"
import { inferGitHubPullRequestUrl } from "./pull-request-inference.js"
import { startPullRequestBabysitting } from "./start-babysitting.js"

type BabysitToolInput = {
  pullRequest?: string
}

/** Adds the /babysit command and babysit model tool for starting a dedicated babysitter session. */
export default Plugin.define({
  id: "opencode-babysit",
  setup: async (context) => {
    const rpc = await context.rpc.register(BabysitRpc, {})
    const start = async (callerSessionID: string, pullRequestInput?: string) => {
      const result = await startPullRequestBabysitting(
        { callerSessionID, pullRequestInput },
        {
          getCallerSession: (sessionID) => context.session.get({ sessionID }),
          getCallerContext: (sessionID) => context.session.context({ sessionID }),
          verifyPullRequest: verifyGitHubPullRequest,
          inferPullRequest: (messages, explicitInput) =>
            inferGitHubPullRequestUrl({
              messages,
              explicitInput,
              generateText: async (prompt) => {
                const result = await context.generate.text({
                  prompt,
                  model: { providerID: "github-copilot", id: "gpt-5.6-luna", variant: "high" },
                })
                return result.text
              },
            }),
          createBabysitterSession: ({ title, location, pullRequestURL, callerSessionID }) =>
            context.session.create({
              title,
              agent: "babysitter",
              location,
              metadata: { pullRequestURL, sourceSessionID: callerSessionID },
            }),
          promptBabysitterSession: async (sessionID, pullRequestURL) => {
            await context.session.prompt({ sessionID, text: `Babysit ${pullRequestURL}` })
          },
        },
      )
      await rpc.events.emit("started", { sessionID: result.sessionID })
      return result
    }

    await context.session.hook("context", async (event) => {
      if (event.agent === "babysitter") {
        delete event.tools.babysit
        return
      }

      const session = await context.session.get({ sessionID: event.sessionID })
      if (session.parentID) delete event.tools.babysit
    })

    await context.command.transform((commands) => {
      commands.add({
        name: "babysit",
        description: "Start a dedicated session to babysit a GitHub pull request",
        execute: async ({ sessionID, prompt, delivery }) => {
          const result = await start(sessionID, prompt.text)
          await context.session.synthetic({
            sessionID,
            text: `Started ${result.title} in session ${result.sessionID}.`,
            description: result.pullRequestURL,
            delivery,
          })
        },
      })
    })

    await context.tool.transform((tools) => {
      tools.add({
        name: "babysit",
        description: "Start a dedicated babysitter session for a GitHub pull request.",
        input: {
          type: "object",
          properties: {
            pullRequest: {
              type: "string",
              description: "Optional GitHub pull request number or full URL.",
            },
          },
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (value, tool) => {
          await tool.progress({ status: "resolving pull request" })
          const input = value as BabysitToolInput
          const result = await start(tool.sessionID, input.pullRequest)
          return {
            content: `Started ${result.title} in session ${result.sessionID}.\n${result.pullRequestURL}`,
            metadata: result,
          }
        },
      })
    })
  },
})
