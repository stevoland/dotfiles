import type { VerifiedGitHubPullRequest } from "./github-pull-request.js"

/** The result returned after a babysitter session has accepted its first prompt. */
export type BabysittingSession = {
  sessionID: string
  pullRequestURL: string
  title: string
}

/** Dependencies behind the start-babysitting interface, kept replaceable for focused tests. */
export type StartBabysittingDependencies = {
  getCallerSession: (sessionID: string) => Promise<{ location: { directory: string; workspaceID?: string } }>
  getCallerContext: (sessionID: string) => Promise<readonly unknown[]>
  verifyPullRequest: (candidate: string, directory: string) => Promise<VerifiedGitHubPullRequest>
  inferPullRequest: (messages: readonly unknown[], explicitInput?: string) => Promise<string | undefined>
  createBabysitterSession: (input: {
    title: string
    location: { directory: string; workspaceID?: string }
    pullRequestURL: string
    callerSessionID: string
  }) => Promise<{ id: string }>
  promptBabysitterSession: (sessionID: string, pullRequestURL: string) => Promise<void>
}

/** Resolves a verified PR before creating and prompting exactly one babysitter session. */
export async function startPullRequestBabysitting(
  input: { callerSessionID: string; pullRequestInput?: string },
  dependencies: StartBabysittingDependencies,
): Promise<BabysittingSession> {
  const caller = await dependencies.getCallerSession(input.callerSessionID)
  const explicitInput = input.pullRequestInput?.trim() || undefined
  let explicitFailure: unknown
  let pullRequest: VerifiedGitHubPullRequest | undefined

  if (explicitInput) {
    try {
      pullRequest = await dependencies.verifyPullRequest(explicitInput, caller.location.directory)
    } catch (error) {
      explicitFailure = error
    }
  }

  if (!pullRequest) {
    const messages = await dependencies.getCallerContext(input.callerSessionID)
    const inferred = await dependencies.inferPullRequest(messages, explicitInput)
    if (inferred) {
      try {
        pullRequest = await dependencies.verifyPullRequest(inferred, caller.location.directory)
      } catch (error) {
        throw new Error(formatResolutionFailure(explicitFailure, error))
      }
    }
  }

  if (!pullRequest) {
    throw new Error(formatResolutionFailure(explicitFailure, "session context did not identify a pull request"))
  }

  const title = `${pullRequest.repo}/${pullRequest.number}: Babysitting`
  const created = await dependencies.createBabysitterSession({
    title,
    location: caller.location,
    pullRequestURL: pullRequest.url,
    callerSessionID: input.callerSessionID,
  })
  await dependencies.promptBabysitterSession(created.id, pullRequest.url)

  return { sessionID: created.id, pullRequestURL: pullRequest.url, title }
}

function formatResolutionFailure(explicitFailure: unknown, inferredFailure: unknown): string {
  const inferred = errorMessage(inferredFailure)
  if (!explicitFailure) return `Babysit pull request resolution failed: ${inferred}`
  return `Babysit pull request resolution failed: explicit input: ${errorMessage(explicitFailure)}; inference: ${inferred}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
