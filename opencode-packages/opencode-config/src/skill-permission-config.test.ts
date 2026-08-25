import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  getAgentSkillPermissionState,
  getSkillPermissionState,
  persistSkillPermission,
  setSkillPermission,
} from "./skill-permission-config.js"

describe("skill permission configuration", () => {
  test("uses a skill rule before the preserved wildcard rule", () => {
    const config = `{
      "permission": {
        "skill": {
          "*": "deny",
          "review": "allow",
          "deploy": "deny"
        }
      }
    }`

    expect(getSkillPermissionState(config, "review")).toBe("allow")
    expect(getSkillPermissionState(config, "deploy")).toBe("deny")
    expect(getSkillPermissionState(config, "other")).toBe("indeterminate")
  })

  test("evaluates the current agent's last matching skill permission", () => {
    const permissions = [
      { action: "*", resource: "*", effect: "deny" },
      { action: "skill", resource: "review", effect: "allow" },
    ] as const

    expect(getAgentSkillPermissionState(permissions, "review")).toBe("allow")
    expect(getAgentSkillPermissionState(permissions, "deploy")).toBe("deny")
  })

  test("preserves ask for the current agent's skill permission", () => {
    expect(
      getAgentSkillPermissionState([{ action: "skill", resource: "review", effect: "ask" }], "review"),
    ).toBe("ask")
    expect(getAgentSkillPermissionState([], "review")).toBe("ask")
  })

  test("sets one skill without discarding unrelated JSONC configuration or wildcard deny", () => {
    const config = `{
      // Keep this setting when toggling a skill.
      "model": "anthropic/claude-sonnet-4-5",
      "permission": {
        "skill": { "*": "deny" },
        "shell": { "git status": "allow" }
      }
    }\n`

    const disabled = setSkillPermission(config, "review", "deny")
    expect(disabled).toContain("Keep this setting")
    expect(disabled).toContain('"model": "anthropic/claude-sonnet-4-5"')
    expect(disabled).toContain('"*": "deny"')
    expect(getSkillPermissionState(disabled, "review")).toBe("deny")

    const enabled = setSkillPermission(disabled, "review", "allow")
    expect(getSkillPermissionState(enabled, "review")).toBe("allow")
    expect(enabled).toContain('"*": "deny"')
    expect(enabled).toContain('"review": "allow"')

    const inherited = setSkillPermission(enabled, "review", "indeterminate")
    expect(getSkillPermissionState(inherited, "review")).toBe("indeterminate")
    expect(inherited).toContain('"*": "deny"')
  })

  test("creates and persists the V1 skill permission map", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencode-config-"))
    const configPath = path.join(directory, ".opencode", "opencode.jsonc")

    try {
      await persistSkillPermission(configPath, "review", "deny")
      expect(getSkillPermissionState(await readFile(configPath, "utf8"), "review")).toBe("deny")

      await persistSkillPermission(configPath, "review", "allow")
      expect(getSkillPermissionState(await readFile(configPath, "utf8"), "review")).toBe("allow")
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
