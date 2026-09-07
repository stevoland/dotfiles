import { describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const OPEN_CODE_HARNESS_SIGNATURE = "OpenCode, a coding agent harness."

/** Proves the plug-in removes Delegation from the real provider-bound harness prompt. */
describe("GPT delegation plug-in end to end", () => {
  test(
    "removes the built-in Delegation section before OpenCode dispatches the provider request",
    async () => {
      const requests: unknown[] = []
      const captureServer = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          if (request.method !== "POST" || new URL(request.url).pathname !== "/v1/chat/completions") {
            return new Response("Not found", { status: 404 })
          }

          requests.push(await request.json())
          return new Response(openAIChatCompletion("OK"), {
            headers: { "content-type": "text/event-stream" },
          })
        },
      })
      const root = await mkdtemp(join(tmpdir(), "opencode-gpt-delegation-"))

      try {
        const projectDirectory = join(root, "project")
        await mkdir(projectDirectory)
        await writeFile(
          join(projectDirectory, "opencode.jsonc"),
          JSON.stringify({
            model: "capture/gpt-5.6-terra",
            plugins: [fileURLToPath(new URL(".", import.meta.url))],
            providers: {
              capture: {
                name: "Captured OpenAI-compatible provider",
                package: "@opencode/ai/providers/openai-compatible",
                settings: {
                  apiKey: "test-key",
                  baseURL: `http://127.0.0.1:${captureServer.port}/v1`,
                },
                models: {
                  "gpt-5.6-terra": {
                    name: "Captured GPT Terra",
                    modelID: "gpt-5.6-terra",
                    family: "gpt-terra",
                    limit: { context: 128_000, output: 4_096 },
                    variants: [{ id: "max", settings: { reasoningEffort: "max" } }],
                  },
                },
              },
            },
          }),
        )

        const command = [
          "/usr/bin/env",
          "-u",
          "OPENCODE_CONFIG",
          "-u",
          "OPENCODE_CONFIG_CONTENT",
          "-u",
          "OPENCODE_CONFIG_PROJECT_DISABLE",
          "-u",
          "OPENCODE_DISABLE_PROJECT_CONFIG",
          `HOME=${root}`,
          `PWD=${projectDirectory}`,
          `OPENCODE_CONFIG_DIR=${join(root, "config")}`,
          `OPENCODE_DB=${join(root, "opencode.db")}`,
          `XDG_CACHE_HOME=${join(root, "cache")}`,
          `XDG_CONFIG_HOME=${join(root, "xdg-config")}`,
          `XDG_DATA_HOME=${join(root, "data")}`,
          `XDG_STATE_HOME=${join(root, "state")}`,
          "opencode",
          "run",
          "--standalone",
          "--format",
          "json",
          "--model",
          "capture/gpt-5.6-terra",
          "Reply with exactly OK.",
        ]
        const process = Bun.spawn(command, { cwd: projectDirectory, stdout: "pipe", stderr: "pipe" })
        const [exitCode, stdout, stderr] = await Promise.all([
          process.exited,
          new Response(process.stdout).text(),
          new Response(process.stderr).text(),
        ])
        expect(exitCode, `OpenCode failed:\n${stderr}\n${stdout}`).toBe(0)

        const harnessPrompt = findCapturedHarnessPrompt(requests)
        expect(harnessPrompt).toContain("# Harness")
        expect(harnessPrompt).toContain("# Destructive actions")
        expect(harnessPrompt).not.toContain("# Delegation")
      } finally {
        captureServer.stop(true)
        await rm(root, { recursive: true, force: true })
      }
    },
    60_000,
  )
})

/** Finds the OpenCode harness system message from captured OpenAI chat-completions request bodies. */
function findCapturedHarnessPrompt(requests: readonly unknown[]): string {
  for (const request of requests) {
    if (!isRecord(request) || !Array.isArray(request.messages)) continue

    for (const message of request.messages) {
      if (!isRecord(message) || message.role !== "system") continue
      const content = openAIMessageText(message.content)
      if (content.includes(OPEN_CODE_HARNESS_SIGNATURE)) return content
    }
  }

  throw new Error(`GPT delegation end-to-end test: no OpenCode harness system message reached the capture provider (${requests.length} requests)`)
}

/** Converts the OpenAI Chat API's string or text-part message body into searchable plain text. */
function openAIMessageText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .filter(isRecord)
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
}

/** Narrows JSON values to records before reading captured provider request fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

/** Creates the smallest streamed OpenAI Chat completion that allows `opencode run` to finish. */
function openAIChatCompletion(text: string): string {
  const chunks = [
    { choices: [{ delta: { role: "assistant" }, finish_reason: null }], usage: null },
    { choices: [{ delta: { content: text }, finish_reason: null }], usage: null },
    { choices: [{ delta: {}, finish_reason: "stop" }], usage: null },
    { choices: [], usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 } },
  ]

  return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`
}
