import { Plugin } from "@opencode-ai/plugin"
import { askGeminiWeb, loadGeminiWebCredentials } from "./gemini-web-client.js"

/** Adds the ask_gemini tool backed by a captured Gemini web session. */
export default Plugin.define({
  id: "opencode-gemini",
  setup: async (context) => {
    await context.tool.transform((tools) => {
      tools.add({
        name: "ask_gemini",
        description: `Gemini is an agent with up-to-date knowledge. Use for abstract questions about architectural approaches etc. No not use for questions requiring retrieving live external data that you can request yourself. Return responses in full including citations and URLs.`,
        input: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The prompt to send to Gemini" },
          },
          required: ["prompt"],
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (input, tool) => {
          await tool.progress({ status: "asking Gemini" })
          const prompt = (input as { prompt: string }).prompt
          console.error("[opencode-gemini] tool invoked", { promptCharacters: prompt.length })
          try {
            console.error("[opencode-gemini] credential availability", {
              requestUrlPresent: Boolean(process.env.GEMINI_WEB_REQUEST_URL),
              requestBodyPresent: Boolean(process.env.GEMINI_WEB_REQUEST_BODY),
              cookieIncluded: Boolean(process.env.GEMINI_WEB_COOKIE),
            })
            const credentials = loadGeminiWebCredentials(process.env)
            console.error("[opencode-gemini] credentials loaded", {
              requestUrlPresent: true,
              requestBodyPresent: true,
              cookieIncluded: Boolean(credentials.cookie),
            })
            return { content: await askGeminiWeb(prompt, credentials) }
          } catch (error) {
            console.error("[opencode-gemini] tool failed", {
              error: describeGeminiToolError(error),
            })
            throw error
          }
        },
      })
    })
  },
})

function describeGeminiToolError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/https?:\/\/[^\s"'`]+/g, "<url>")
    .replace(/(cookie|authorization|requestBody|requestUrl)[^=:]*=\s*[^\s,}]+/gi, "$1=<redacted>")
}
