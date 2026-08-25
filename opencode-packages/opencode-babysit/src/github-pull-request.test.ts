import { expect, test } from "bun:test"
import { parseInferredPullRequestUrl, verifyGitHubPullRequest } from "./github-pull-request.js"

test("verifyGitHubPullRequest verifies a number in the calling directory", async () => {
  let invocation: { args: string[]; directory: string } | undefined
  const result = await verifyGitHubPullRequest("42", "/workspace/repo", async (args, directory) => {
    invocation = { args, directory }
    return JSON.stringify({ url: "https://github.com/acme/widgets/pull/42", number: 42 })
  })

  expect(invocation).toEqual({
    args: ["pr", "view", "42", "--json", "url,number"],
    directory: "/workspace/repo",
  })
  expect(result).toEqual({
    url: "https://github.com/acme/widgets/pull/42",
    owner: "acme",
    repo: "widgets",
    number: 42,
  })
})

test("verifyGitHubPullRequest rejects non-PR input before calling GitHub", async () => {
  let called = false
  await expect(
    verifyGitHubPullRequest("an issue", "/workspace/repo", async () => {
      called = true
      return ""
    }),
  ).rejects.toThrow("positive PR number or github.com pull request URL")
  expect(called).toBe(false)
})

test("parseInferredPullRequestUrl accepts exactly one URL", () => {
  expect(parseInferredPullRequestUrl("https://github.com/acme/widgets/pull/42")).toBe(
    "https://github.com/acme/widgets/pull/42",
  )
  expect(parseInferredPullRequestUrl("NONE")).toBeUndefined()
  expect(
    parseInferredPullRequestUrl(
      "https://github.com/acme/widgets/pull/42 https://github.com/acme/widgets/pull/43",
    ),
  ).toBeUndefined()
  expect(parseInferredPullRequestUrl("https://github.com/acme/widgets/pull/42garbage")).toBeUndefined()
  expect(parseInferredPullRequestUrl("Result: https://github.com/acme/widgets/pull/42")).toBeUndefined()
})
