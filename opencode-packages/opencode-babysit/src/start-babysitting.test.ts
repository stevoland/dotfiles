import { expect, test } from "bun:test"
import type { StartBabysittingDependencies } from "./start-babysitting.js"
import { startPullRequestBabysitting } from "./start-babysitting.js"

function createDependencies(events: string[]): StartBabysittingDependencies {
  return {
    getCallerSession: async () => ({ location: { directory: "/workspace/repo", workspaceID: "work" } }),
    getCallerContext: async () => [{ type: "user", text: "the PR" }],
    verifyPullRequest: async (candidate) => ({
      url: candidate.startsWith("http") ? candidate : "https://github.com/acme/widgets/pull/42",
      owner: "acme",
      repo: "widgets",
      number: 42,
    }),
    inferPullRequest: async () => "https://github.com/acme/widgets/pull/42",
    createBabysitterSession: async (input) => {
      events.push(`create:${input.title}:${input.location.directory}`)
      return { id: "ses_babysitter" }
    },
    promptBabysitterSession: async (sessionID, url) => {
      events.push(`prompt:${sessionID}:${url}`)
    },
  }
}

test("startPullRequestBabysitting verifies before creating the titled session", async () => {
  const events: string[] = []
  const dependencies = createDependencies(events)
  const verify = dependencies.verifyPullRequest
  dependencies.inferPullRequest = async () => {
    throw new Error("inference should not run for verified explicit input")
  }
  dependencies.verifyPullRequest = async (candidate, directory) => {
    events.push(`verify:${candidate}:${directory}`)
    return verify(candidate, directory)
  }

  const result = await startPullRequestBabysitting(
    { callerSessionID: "ses_caller", pullRequestInput: "42" },
    dependencies,
  )

  expect(events).toEqual([
    "verify:42:/workspace/repo",
    "create:widgets/42: Babysitting:/workspace/repo",
    "prompt:ses_babysitter:https://github.com/acme/widgets/pull/42",
  ])
  expect(result).toEqual({
    sessionID: "ses_babysitter",
    pullRequestURL: "https://github.com/acme/widgets/pull/42",
    title: "widgets/42: Babysitting",
  })
})

test("startPullRequestBabysitting falls back to context inference", async () => {
  const events: string[] = []
  const dependencies = createDependencies(events)
  dependencies.verifyPullRequest = async (candidate) => {
    events.push(`verify:${candidate}`)
    if (candidate === "wrong") throw new Error("not found")
    return {
      url: candidate,
      owner: "acme",
      repo: "widgets",
      number: 42,
    }
  }
  dependencies.inferPullRequest = async (_messages, explicitInput) => {
    events.push(`infer:${explicitInput}`)
    return "https://github.com/acme/widgets/pull/42"
  }

  await startPullRequestBabysitting(
    { callerSessionID: "ses_caller", pullRequestInput: "wrong" },
    dependencies,
  )

  expect(events.slice(0, 3)).toEqual([
    "verify:wrong",
    "infer:wrong",
    "verify:https://github.com/acme/widgets/pull/42",
  ])
})

test("startPullRequestBabysitting does not create a session without a verified PR", async () => {
  const events: string[] = []
  const dependencies = createDependencies(events)
  dependencies.inferPullRequest = async () => undefined

  await expect(
    startPullRequestBabysitting({ callerSessionID: "ses_caller" }, dependencies),
  ).rejects.toThrow("session context did not identify a pull request")
  expect(events).toEqual([])
})
