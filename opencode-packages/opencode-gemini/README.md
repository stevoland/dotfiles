# opencode-gemini

An OpenCode V2 plugin that adds an `ask_gemini` tool backed by Gemini's private web endpoint.

> [!WARNING]
> This is an unofficial integration. Google can change the request format at any time, and captured credentials expire. Prefer Google's supported Gemini API when reliability matters.

## Configure

Open <https://gemini.google.com> in Chrome, open **Developer Tools → Network**, and send a throwaway prompt. Filter requests for `StreamGenerate`, right-click the generation request, then select **Copy → Copy as cURL**.

The copied command contains the three values used by the plugin:

- `GEMINI_WEB_REQUEST_URL`: the full `https://gemini.google.com/.../StreamGenerate?...` URL after `curl`
- `GEMINI_WEB_REQUEST_BODY`: the complete value after `--data-raw`
- `GEMINI_WEB_COOKIE`: the value of the `cookie:` request header, if the copied command includes one

Export them in the environment that starts the OpenCode background service:

```sh
export GEMINI_WEB_REQUEST_URL='https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?...'
export GEMINI_WEB_REQUEST_BODY='f.req=...&at=...&'
export GEMINI_WEB_COOKIE='...'
opencode2 service restart
```

The request URL, body, and cookie are credentials. Do not commit them, put them in OpenCode configuration, or share the copied cURL command. Capture a new request and restart OpenCode when Gemini rejects expired credentials.

## Install

Add the package to `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-gemini"]
}
```

For local development, reference this checkout instead:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/absolute/path/to/opencode-packages/opencode-gemini/src/index.ts"
  ]
}
```

The plugin registers this tool:

```json
{
  "prompt": "Compare these two implementation approaches"
}
```

## Debugging

The plugin emits redacted diagnostics with the `[opencode-gemini]` prefix. Check
the OpenCode service log after one invocation:

```sh
grep '\[opencode-gemini\]' ~/.local/share/opencode/log/opencode.log
```

The diagnostics include the request stage, HTTP status, response content type,
and response sizes. Request URLs, cookies, request bodies, and prompts are not
logged.

## Develop

```sh
bun install
bun test
bun run typecheck
```
