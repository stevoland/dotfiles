import { describe, expect, test } from "bun:test"
import {
  createGeminiWebRequest,
  extractGeminiResponseText,
  askGeminiWeb,
  loadGeminiWebCredentials,
  type GeminiWebCredentials,
} from "./gemini-web-client.js"

const credentials: GeminiWebCredentials = {
  requestUrl:
    "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=build&f.sid=session&_reqid=1&rt=c",
  requestBody: createCapturedRequestBody("captured prompt"),
  cookie: "session=cookie",
}

describe("Gemini web client", () => {
  test("loads only the named Gemini environment credentials", () => {
    expect(
      loadGeminiWebCredentials({
        GEMINI_WEB_REQUEST_URL: credentials.requestUrl,
        GEMINI_WEB_REQUEST_BODY: credentials.requestBody,
        GEMINI_WEB_COOKIE: credentials.cookie,
      }),
    ).toEqual(credentials)
  })

  test("rejects a request URL that could exfiltrate credentials", () => {
    expect(() =>
      loadGeminiWebCredentials({
        GEMINI_WEB_REQUEST_URL: "https://example.com/collect",
        GEMINI_WEB_REQUEST_BODY: credentials.requestBody,
      }),
    ).toThrow("request URL must be the Gemini StreamGenerate HTTPS endpoint")
  })

  test("replaces the captured prompt without changing opaque request fields", async () => {
    const request = createGeminiWebRequest("new prompt", credentials)
    const body = new URLSearchParams(await request.text())
    const outerRequest = JSON.parse(body.get("f.req")!)
    const innerRequest = JSON.parse(outerRequest[1])

    expect(innerRequest[0][0]).toBe("new prompt")
    expect(innerRequest[3]).toBe("opaque-request-token")
    expect(body.get("at")).toBe("anti-csrf-token")
    expect(request.headers.get("cookie")).toBe("session=cookie")
  })

  test("extracts generated text from a length-prefixed XSSI response", () => {
    const payload = [null, ["conversation", "response"], null, null, [["candidate", ["Hello", " world"]]]]
    const frame = JSON.stringify([["wrb.fr", null, JSON.stringify(payload)]])
    const response = new TextEncoder().encode(`)]}'\n\n${new TextEncoder().encode(frame).byteLength}\n${frame}`)

    expect(extractGeminiResponseText(response)).toBe("Hello world")
  })

  test("waits for the complete generated answer after a stream pause", async () => {
    const originalFetch = globalThis.fetch
    const partialAnswer = "Here is the example:\n\n```ts\n"
    const completeAnswer = `${partialAnswer}console.log("complete")\n\`\`\``
    globalThis.fetch = (async () =>
      new Response(createPausedGeminiResponse(partialAnswer, completeAnswer))) as unknown as typeof fetch

    try {
      await expect(askGeminiWeb("show a code example", credentials)).resolves.toBe(completeAnswer)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("returns after Gemini's terminal frame when the HTTP stream stays open", async () => {
    const originalFetch = globalThis.fetch
    const completeAnswer = "The complete answer"
    let finishStreamCancellation: (() => void) | undefined
    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`${createGeminiResponse(completeAnswer)}\n${createTerminalFrame()}`))
          },
          cancel() {
            return new Promise<void>((resolve) => {
              finishStreamCancellation = resolve
            })
          },
        }),
      )) as unknown as typeof fetch

    const pendingAnswer = askGeminiWeb("show a complete answer", credentials)
    try {
      const outcome = await Promise.race([
        pendingAnswer,
        new Promise<"still-reading">((resolve) => setTimeout(() => resolve("still-reading"), 100)),
      ])
      if (outcome === "still-reading") {
        finishStreamCancellation?.()
        await pendingAnswer
      }
      expect(outcome).toBe(completeAnswer)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("returns after a complete answer becomes idle without a terminal frame", async () => {
    const originalFetch = globalThis.fetch
    const completeAnswer = "The complete answer without a terminal frame"
    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(createGeminiResponse(completeAnswer)))
          },
        }),
      )) as unknown as typeof fetch

    try {
      await expect(askGeminiWeb("show a complete answer", credentials, { responseIdleTimeoutMs: 20 })).resolves.toBe(
        completeAnswer,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("logs request diagnostics without logging captured credentials", async () => {
    const originalFetch = globalThis.fetch
    const originalError = console.error
    const logs: string[] = []
    globalThis.fetch = (async () => new Response(createGeminiResponse("Hello world"))) as unknown as typeof fetch
    console.error = (...args) => logs.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "))

    try {
      await askGeminiWeb("new prompt", credentials)
    } finally {
      globalThis.fetch = originalFetch
      console.error = originalError
    }

    const output = logs.join("\n")
    expect(output).toContain("[opencode-gemini] request")
    expect(output).toContain("[opencode-gemini] completed")
    expect(output).not.toContain(credentials.cookie!)
    expect(output).not.toContain("anti-csrf-token")
  })

  test("logs the stage when request construction fails", async () => {
    const originalError = console.error
    const logs: string[] = []
    console.error = (...args) => logs.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "))

    try {
      await expect(
        askGeminiWeb("new prompt", { ...credentials, requestBody: "f.req=invalid" }),
      ).rejects.toThrow("f.req does not contain a StreamGenerate payload")
    } finally {
      console.error = originalError
    }

    expect(logs.join("\n")).toContain('"stage":"create-request"')
  })
})

function createCapturedRequestBody(prompt: string): string {
  const innerRequest = [[prompt, 0, null, null, null, null, 0], ["en-GB"], [], "opaque-request-token"]
  const outerRequest = [null, JSON.stringify(innerRequest)]
  return new URLSearchParams({ "f.req": JSON.stringify(outerRequest), at: "anti-csrf-token" }).toString()
}

function createGeminiResponse(answer: string): string {
  const payload = [null, ["conversation", "response"], null, null, [["candidate", [answer]]]]
  const frame = JSON.stringify([["wrb.fr", null, JSON.stringify(payload)]])
  const length = new TextEncoder().encode(frame).byteLength
  return `)]}'\n${length}\n${frame}`
}

function createTerminalFrame(): string {
  const frame = JSON.stringify([["e", 82, null, null, 123]])
  return `${new TextEncoder().encode(frame).byteLength}\n${frame}`
}

function createPausedGeminiResponse(partialAnswer: string, completeAnswer: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(createGeminiResponse(partialAnswer)))
      setTimeout(() => {
        controller.enqueue(encoder.encode(`\n${createGeminiResponse(completeAnswer)}`))
        controller.close()
      }, 1_600)
    },
  })
}
