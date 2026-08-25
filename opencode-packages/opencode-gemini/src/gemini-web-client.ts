const GEMINI_STREAM_GENERATE_PATH = "/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate"
const GEMINI_RESPONSE_IDLE_TIMEOUT_MS = 5_000
const GEMINI_RESPONSE_TIMEOUT_MS = 45_000
const GEMINI_LOG_PREFIX = "[opencode-gemini]"

export interface GeminiWebCredentials {
  requestUrl: string
  requestBody: string
  cookie?: string
}

export interface GeminiWebClientOptions {
  responseIdleTimeoutMs?: number
}

interface GeminiWebEnvironment {
  [name: string]: string | undefined
  GEMINI_WEB_REQUEST_URL?: string
  GEMINI_WEB_REQUEST_BODY?: string
  GEMINI_WEB_COOKIE?: string
}

interface GeminiResponseReadProgress {
  chunks: number
  bytes: number
  terminalFrameReceived: boolean
}

/** Reads the captured Gemini web request credentials from named environment variables. */
export function loadGeminiWebCredentials(environment: GeminiWebEnvironment): GeminiWebCredentials {
  const requestUrl = environment.GEMINI_WEB_REQUEST_URL
  const requestBody = environment.GEMINI_WEB_REQUEST_BODY
  if (!requestUrl) throw new Error("Gemini web credentials missing: GEMINI_WEB_REQUEST_URL is required")
  if (!requestBody) throw new Error("Gemini web credentials missing: GEMINI_WEB_REQUEST_BODY is required")

  validateGeminiRequestUrl(requestUrl)
  return { requestUrl, requestBody, cookie: environment.GEMINI_WEB_COOKIE || undefined }
}

/** Sends one prompt using a captured, short-lived Gemini web request. */
export async function askGeminiWeb(
  prompt: string,
  credentials: GeminiWebCredentials,
  options: GeminiWebClientOptions = {},
): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_RESPONSE_TIMEOUT_MS)
  const readProgress: GeminiResponseReadProgress = { chunks: 0, bytes: 0, terminalFrameReceived: false }
  let stage = "create-request"

  try {
    const request = createGeminiWebRequest(prompt, credentials)
    geminiLog("request", {
      promptCharacters: prompt.length,
      requestPath: new URL(credentials.requestUrl).pathname,
      requestQueryKeys: [...new URL(credentials.requestUrl).searchParams.keys()].sort(),
      requestBodyCharacters: credentials.requestBody.length,
      cookieIncluded: Boolean(credentials.cookie),
    })

    stage = "fetch"
    const response = await fetch(request, { signal: controller.signal })
    geminiLog("response", {
      status: response.status,
      contentType: response.headers.get("content-type") ?? undefined,
      bodyPresent: Boolean(response.body),
    })
    if (!response.ok) throw new Error(`Gemini web request failed: HTTP ${response.status}`)
    if (!response.body) throw new Error("Gemini web request failed: response body was empty")

    stage = "read-stream"
    const body = await readCompleteGeminiStreamingResponse(
      response.body,
      readProgress,
      options.responseIdleTimeoutMs ?? GEMINI_RESPONSE_IDLE_TIMEOUT_MS,
    )
    stage = "parse-response"
    const answer = extractGeminiResponseText(body)
    if (!answer) throw new Error("Gemini web response invalid: no generated text was found")
    geminiLog("completed", { responseBytes: body.byteLength, answerCharacters: answer.length })
    return answer
  } catch (error) {
    geminiLog("failed", { stage, aborted: controller.signal.aborted, error: describeGeminiError(error) })
    if (controller.signal.aborted) {
      throw new Error(
        `Gemini web request timed out during ${stage} after ${readProgress.bytes} bytes in ${readProgress.chunks} chunks (terminal frame received: ${readProgress.terminalFrameReceived})`,
      )
    }
    throw error
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

function geminiLog(event: string, details: Record<string, unknown>): void {
  console.error(`${GEMINI_LOG_PREFIX} ${event}`, details)
}

function describeGeminiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/https?:\/\/[^\s"'`]+/g, "<url>")
    .replace(/(cookie|authorization|requestBody|requestUrl)[^=:]*=\s*[^\s,}]+/gi, "$1=<redacted>")
}

/** Builds a Gemini StreamGenerate request while replacing only the captured prompt. */
export function createGeminiWebRequest(prompt: string, credentials: GeminiWebCredentials): Request {
  if (!prompt.trim()) throw new Error("Gemini prompt invalid: prompt must not be empty")

  const url = validateGeminiRequestUrl(credentials.requestUrl)
  url.searchParams.set("_reqid", String(Date.now() % 10_000_000))

  const body = new URLSearchParams(credentials.requestBody)
  const encodedRequest = body.get("f.req")
  if (!encodedRequest) throw new Error("Gemini web credentials invalid: request body has no f.req field")

  try {
    const outerRequest = JSON.parse(encodedRequest) as unknown
    if (!Array.isArray(outerRequest) || typeof outerRequest[1] !== "string") throw new Error("outer request")
    const innerRequest = JSON.parse(outerRequest[1]) as unknown
    if (!Array.isArray(innerRequest) || !Array.isArray(innerRequest[0])) throw new Error("inner request")
    innerRequest[0][0] = prompt
    outerRequest[1] = JSON.stringify(innerRequest)
    body.set("f.req", JSON.stringify(outerRequest))
  } catch {
    throw new Error("Gemini web credentials invalid: f.req does not contain a StreamGenerate payload")
  }

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    "Origin": "https://gemini.google.com",
    "Referer": "https://gemini.google.com/",
    "X-Same-Domain": "1",
  })
  if (credentials.cookie) headers.set("Cookie", credentials.cookie)

  return new Request(url, { method: "POST", headers, body: body.toString() })
}

/** Extracts the latest generated answer from Gemini's length-prefixed XSSI stream. */
export function extractGeminiResponseText(responseBody: Uint8Array): string | undefined {
  let latestAnswer: string | undefined
  for (const frame of parseGeminiResponseFrames(responseBody)) {
    for (const payload of findGeminiResponsePayloads(frame)) {
      const candidates = payload[4]
      if (!Array.isArray(candidates)) continue
      for (const candidate of candidates) {
        if (!Array.isArray(candidate) || !Array.isArray(candidate[1])) continue
        const answer = candidate[1].filter((part): part is string => typeof part === "string").join("")
        if (answer) latestAnswer = answer
      }
    }
  }
  return latestAnswer
}

/** Reads every response chunk so pauses between partial answers cannot truncate generated text. */
async function readCompleteGeminiStreamingResponse(
  stream: ReadableStream<Uint8Array>,
  progress: GeminiResponseReadProgress,
  idleTimeoutMs: number,
): Promise<Uint8Array> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  let incompleteFrameText = ""
  let answerReceived = false

  while (true) {
    const idleResult = Symbol("idle")
    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const result = await Promise.race([
      reader.read(),
      ...(answerReceived
        ? [new Promise<typeof idleResult>((resolve) => (idleTimer = setTimeout(() => resolve(idleResult), idleTimeoutMs)))]
        : []),
    ])
    if (idleTimer) clearTimeout(idleTimer)
    if (result === idleResult) {
      void reader.cancel()
      break
    }
    if (result.done) break

    chunks.push(result.value)
    totalBytes += result.value.byteLength
    progress.chunks += 1
    progress.bytes = totalBytes
    incompleteFrameText += decoder.decode(result.value, { stream: true })
    answerReceived = Boolean(extractGeminiResponseText(joinByteChunks(chunks, totalBytes)))

    const frameLines = incompleteFrameText.split(/\r?\n/)
    incompleteFrameText = frameLines.pop() ?? ""
    if (frameLines.some(isGeminiTerminalFrameLine) || isGeminiTerminalFrameLine(incompleteFrameText)) {
      progress.terminalFrameReceived = true
      void reader.cancel()
      break
    }
  }

  return joinByteChunks(chunks, totalBytes)
}

function isGeminiTerminalFrameLine(line: string): boolean {
  const trimmedLine = line.trim()
  if (!trimmedLine.startsWith("[")) return false

  try {
    const frame = JSON.parse(trimmedLine) as unknown
    return Array.isArray(frame) && frame.some((entry) => Array.isArray(entry) && entry[0] === "e")
  } catch {
    return false
  }
}

function validateGeminiRequestUrl(requestUrl: string): URL {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    throw new Error("Gemini web credentials invalid: GEMINI_WEB_REQUEST_URL is not a URL")
  }
  if (url.protocol !== "https:" || url.hostname !== "gemini.google.com" || url.pathname !== GEMINI_STREAM_GENERATE_PATH) {
    throw new Error("Gemini web credentials invalid: request URL must be the Gemini StreamGenerate HTTPS endpoint")
  }
  return url
}

function parseGeminiResponseFrames(responseBody: Uint8Array): unknown[] {
  const responseText = new TextDecoder().decode(responseBody)
  const lines = responseText.split(/\r?\n/)
  const frames: unknown[] = []
  for (const [index, line] of lines.entries()) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine === ")]}'" || /^\d+$/.test(trimmedLine)) continue
    try {
      frames.push(JSON.parse(trimmedLine))
    } catch {
      if (index === lines.length - 1) break
      throw new Error("Gemini web response invalid: stream frame was not JSON")
    }
  }
  return frames
}

function findGeminiResponsePayloads(value: unknown): unknown[][] {
  if (!Array.isArray(value)) return []
  const payloads: unknown[][] = []
  if (value[0] === "wrb.fr" && typeof value[2] === "string") {
    try {
      const payload = JSON.parse(value[2]) as unknown
      if (Array.isArray(payload)) payloads.push(payload)
    } catch {
      throw new Error("Gemini web response invalid: wrb.fr payload was not JSON")
    }
  }
  for (const child of value) payloads.push(...findGeminiResponsePayloads(child))
  return payloads
}

function joinByteChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const joined = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return joined
}
