import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

/** A GitHub pull request identity verified by GitHub CLI. */
export type VerifiedGitHubPullRequest = {
  url: string
  owner: string
  repo: string
  number: number
}

/** Runs a GitHub CLI command in the calling session's working directory. */
export type GitHubCommandRunner = (args: string[], directory: string) => Promise<string>

/** Executes GitHub CLI and returns standard output without logging session-derived input. */
export async function runGitHubCommand(args: string[], directory: string): Promise<string> {
  try {
    const result = await execFileAsync("gh", args, {
      cwd: directory,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    })
    return result.stdout
  } catch (error) {
    const detail = commandErrorDetail(error)
    throw new Error(`GitHub pull request lookup failed: ${detail}`)
  }
}

/** Verifies a PR number or GitHub pull request URL and returns GitHub's canonical URL. */
export async function verifyGitHubPullRequest(
  candidate: string,
  directory: string,
  runCommand: GitHubCommandRunner = runGitHubCommand,
): Promise<VerifiedGitHubPullRequest> {
  const reference = normalizePullRequestReference(candidate)
  const output = await runCommand(["pr", "view", reference, "--json", "url,number"], directory)

  let result: unknown
  try {
    result = JSON.parse(output)
  } catch {
    throw new Error("GitHub pull request lookup returned invalid JSON")
  }

  if (!isGitHubPullRequestResult(result)) {
    throw new Error("GitHub pull request lookup returned an invalid response")
  }

  const identity = parseGitHubPullRequestUrl(result.url)
  if (!identity || identity.number !== result.number) {
    throw new Error("GitHub pull request lookup returned an invalid URL")
  }

  return { ...identity, url: `https://github.com/${identity.owner}/${identity.repo}/pull/${identity.number}` }
}

/** Extracts the single GitHub pull request URL returned by the inference model. */
export function parseInferredPullRequestUrl(output: string): string | undefined {
  const value = output.trim()
  if (value.toUpperCase() === "NONE") return undefined
  return parseGitHubPullRequestUrl(value) ? value.replace(/\/$/, "") : undefined
}

function normalizePullRequestReference(candidate: string): string {
  const value = candidate.trim()
  if (/^[1-9]\d*$/.test(value)) return value
  if (parseGitHubPullRequestUrl(value)) return value
  throw new Error("GitHub pull request input must be a positive PR number or github.com pull request URL")
}

function parseGitHubPullRequestUrl(
  value: string,
): { owner: string; repo: string; number: number } | undefined {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/([1-9]\d*)(?:[/?#].*)?$/.exec(value)
  if (!match) return undefined
  return { owner: match[1], repo: match[2], number: Number(match[3]) }
}

function isGitHubPullRequestResult(value: unknown): value is { url: string; number: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    "number" in value &&
    typeof value.number === "number"
  )
}

function commandErrorDetail(error: unknown): string {
  if (typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string") {
    const stderr = error.stderr.trim()
    if (stderr) return stderr
  }
  return error instanceof Error ? error.message : String(error)
}
