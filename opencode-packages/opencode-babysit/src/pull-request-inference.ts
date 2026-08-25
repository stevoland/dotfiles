import { parseInferredPullRequestUrl } from "./github-pull-request.js"

type SessionContextMessage = {
  type?: string
  text?: string
  content?: unknown
  status?: string
  summary?: string
  command?: string
}

/** Projects session context into text while retaining tool inputs and removing tool results. */
export function buildPullRequestInferenceTranscript(messages: readonly unknown[]): string {
  const entries: string[] = []

  for (const value of messages) {
    if (!isSessionContextMessage(value)) continue

    if (value.type === "user" && value.text) {
      entries.push(`USER:\n${value.text}`)
      continue
    }

    if (value.type === "synthetic" && value.text) {
      entries.push(`SESSION EVENT:\n${value.text}`)
      continue
    }

    if (value.type === "compaction" && value.status === "completed") {
      const summary = typeof value.summary === "string" ? value.summary : ""
      if (summary) entries.push(`COMPACTED CONTEXT:\n${summary}`)
      continue
    }

    if (value.type === "shell" && typeof value.command === "string") {
      entries.push(`SHELL COMMAND:\n${value.command}`)
      continue
    }

    if (value.type === "assistant" && Array.isArray(value.content)) {
      const assistantEntries: string[] = []
      for (const part of value.content) {
        if (!isRecord(part)) continue
        if (part.type === "text" && typeof part.text === "string") {
          assistantEntries.push(part.text)
          continue
        }
        if (part.type === "tool" && typeof part.name === "string" && isRecord(part.state)) {
          assistantEntries.push(`TOOL ${part.name} INPUT: ${JSON.stringify(part.state.input ?? {})}`)
        }
      }
      if (assistantEntries.length) entries.push(`ASSISTANT:\n${assistantEntries.join("\n")}`)
    }
  }

  return entries.join("\n\n")
}

/** Builds the bounded-purpose prompt used by Luna to infer one pull request URL. */
export function buildPullRequestInferencePrompt(
  messages: readonly unknown[],
  explicitInput?: string,
): string {
  const transcript = buildPullRequestInferenceTranscript(messages)
  const hint = explicitInput?.trim() ? `\nThe caller supplied this unverified hint: ${explicitInput.trim()}\n` : ""
  return `Infer the GitHub pull request being discussed in the session transcript below.${hint}
Return exactly one full URL in the form https://github.com/OWNER/REPO/pull/NUMBER.
Return NONE if the pull request cannot be inferred confidently. Do not explain your answer.

SESSION TRANSCRIPT:
${transcript}`
}

/** Runs pull request inference and accepts only one GitHub pull request URL. */
export async function inferGitHubPullRequestUrl(input: {
  messages: readonly unknown[]
  explicitInput?: string
  generateText: (prompt: string) => Promise<string>
}): Promise<string | undefined> {
  const output = await input.generateText(buildPullRequestInferencePrompt(input.messages, input.explicitInput))
  return parseInferredPullRequestUrl(output)
}

function isSessionContextMessage(value: unknown): value is SessionContextMessage {
  return isRecord(value) && typeof value.type === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
