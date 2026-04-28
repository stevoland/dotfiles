{
  "id": "fdbfcdb7",
  "title": "Wrap read tool to read full files under skills directories",
  "tags": [
    "pi",
    "tools",
    "read"
  ],
  "status": "closed",
  "created_at": "2026-05-28T16:02:31.516Z"
}

Implemented a global auto-discovered extension at `agent/extensions/read-skills-full/index.ts` that overrides Pi's built-in `read` tool via `createReadToolDefinition(...)` and strips `offset`/`limit` whenever the resolved path is under a directory segment named `skills`. Added focused tests at `agent/extensions/read-skills-full/index.test.ts` and verified with `cd agent && bun test ./extensions/read-skills-full/index.test.ts`.
