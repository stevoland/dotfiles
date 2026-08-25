import { expect, test } from "bun:test"
import { buildPullRequestInferenceTranscript, inferGitHubPullRequestUrl } from "./pull-request-inference.js"

test("buildPullRequestInferenceTranscript strips tool results but keeps tool inputs", () => {
  const transcript = buildPullRequestInferenceTranscript([
    { type: "user", text: "Please sort out the PR" },
    {
      type: "assistant",
      content: [
        { type: "text", text: "Checking it." },
        {
          type: "tool",
          name: "shell",
          state: {
            status: "completed",
            input: { command: "gh pr view 42" },
            content: [{ type: "text", text: "expensive result" }],
          },
        },
        { type: "reasoning", text: "hidden reasoning" },
      ],
    },
  ])

  expect(transcript).toContain("Please sort out the PR")
  expect(transcript).toContain('TOOL shell INPUT: {"command":"gh pr view 42"}')
  expect(transcript).not.toContain("expensive result")
  expect(transcript).not.toContain("hidden reasoning")
})

test("buildPullRequestInferenceTranscript preserves compacted context and strips shell output", () => {
  const transcript = buildPullRequestInferenceTranscript([
    {
      type: "compaction",
      status: "completed",
      summary: "Working on https://github.com/acme/widgets/pull/42",
      recent: "[Assistant tool call]: shell({})\n[Tool result]: expensive compacted result",
    },
    {
      type: "shell",
      command: "gh pr view 42",
      output: { output: "large shell result", cursor: 0, size: 18, truncated: false },
    },
  ])

  expect(transcript).toContain("https://github.com/acme/widgets/pull/42")
  expect(transcript).toContain("gh pr view 42")
  expect(transcript).not.toContain("large shell result")
  expect(transcript).not.toContain("expensive compacted result")
})

test("inferGitHubPullRequestUrl parses the Luna response", async () => {
  let prompt = ""
  const result = await inferGitHubPullRequestUrl({
    messages: [{ type: "user", text: "PR 42 in acme/widgets" }],
    explicitInput: "42",
    generateText: async (value) => {
      prompt = value
      return "https://github.com/acme/widgets/pull/42"
    },
  })

  expect(prompt).toContain("unverified hint: 42")
  expect(result).toBe("https://github.com/acme/widgets/pull/42")
})
