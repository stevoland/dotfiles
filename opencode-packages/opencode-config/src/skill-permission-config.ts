import { applyEdits, modify, parse, type ParseError } from "jsonc-parser"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

type OpenCodeConfig = {
  permission?: unknown
  [key: string]: unknown
}

type SkillPermissions = Record<string, unknown>

/** The explicit V1 skill permission, or indeterminate when the skill has no exact entry. */
export type SkillPermissionState = "allow" | "deny" | "indeterminate"

/** The effective current-agent skill permission, including OpenCode's ask state. */
export type AgentSkillPermissionState = SkillPermissionState | "ask"

type AgentPermissionRule = {
  readonly action: string
  readonly resource: string
  readonly effect: "allow" | "deny" | "ask"
}

const jsoncOptions = { allowTrailingComma: true }
const formattingOptions = { tabSize: 2, insertSpaces: true }

/** Reads the global OpenCode configuration path, preferring an existing JSON or JSONC file. */
export async function resolveGlobalConfigPath(homeDirectory = os.homedir()): Promise<string> {
  return resolveConfigPath(path.join(homeDirectory, ".config", "opencode"))
}

/** Reads the project-local `.opencode` configuration path, preferring an existing JSON or JSONC file. */
export async function resolveLocalConfigPath(directory: string): Promise<string> {
  return resolveConfigPath(path.join(directory, ".opencode"))
}

/** Reads a skill's exact V1 `permission.skill` state without applying the wildcard entry. */
export function getSkillPermissionState(configText: string, skillID: string): SkillPermissionState {
  const config = parseConfigText(configText)
  const skills = getSkillPermissions(config)
  const permission = skills[skillID]
  if (permission === "allow" || permission === "deny") return permission
  return "indeterminate"
}

/** Evaluates the current agent's last matching skill permission rule. */
export function getAgentSkillPermissionState(
  permissions: readonly AgentPermissionRule[],
  skillID: string,
): AgentSkillPermissionState {
  let permission: AgentPermissionRule | undefined
  for (let index = permissions.length - 1; index >= 0; index -= 1) {
    const candidate = permissions[index]
    if (candidate && matchesPermission("skill", candidate.action) && matchesPermission(skillID, candidate.resource)) {
      permission = candidate
      break
    }
  }
  return permission?.effect ?? "ask"
}

/** Sets or clears one skill's V1 permission while preserving wildcard and unrelated JSONC configuration. */
export function setSkillPermission(
  configText: string,
  skillID: string,
  state: SkillPermissionState,
): string {
  const config = parseConfigText(configText)
  getSkillPermissions(config)
  const updated = applyEdits(
    configText,
    modify(
      configText,
      ["permission", "skill", skillID],
      state === "indeterminate" ? undefined : state,
      { formattingOptions },
    ),
  )
  parseConfigText(updated)
  return updated.endsWith("\n") ? updated : `${updated}\n`
}

/** Updates a skill permission on disk, creating the requested config location when necessary. */
export async function persistSkillPermission(
  configPath: string,
  skillID: string,
  state: SkillPermissionState,
): Promise<void> {
  const configText = await readConfigText(configPath)
  const updated = setSkillPermission(configText, skillID, state)
  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(configPath, updated, { encoding: "utf8", mode: 0o600 })
}

async function resolveConfigPath(directory: string): Promise<string> {
  const candidates = [path.join(directory, "opencode.json"), path.join(directory, "opencode.jsonc")]
  for (const candidate of candidates) {
    if (
      await stat(candidate).then(
        (info) => info.isFile(),
        () => false,
      )
    ) {
      return candidate
    }
  }
  return candidates[1]
}

async function readConfigText(configPath: string): Promise<string> {
  return readFile(configPath, "utf8").catch((error: unknown) => {
    if (isFileNotFound(error)) return "{}"
    throw error
  })
}

function matchesPermission(value: string, pattern: string): boolean {
  const normalizedValue = value.replaceAll("\\", "/")
  const normalizedPattern = pattern.replaceAll("\\", "/")
  const expression = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*")
    .replaceAll("?", ".")
  return new RegExp(`^${expression}$`, "s").test(normalizedValue)
}

function parseConfigText(configText: string): OpenCodeConfig {
  const errors: ParseError[] = []
  const parsed = parse(configText, errors, jsoncOptions)
  if (errors.length > 0 || parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenCode config contains invalid JSONC")
  }
  return parsed as OpenCodeConfig
}

function getSkillPermissions(config: OpenCodeConfig): SkillPermissions {
  if (config.permission === undefined) return {}
  if (config.permission === null || typeof config.permission !== "object" || Array.isArray(config.permission)) {
    throw new Error("OpenCode config permission must be an object")
  }
  const permission = config.permission as Record<string, unknown>
  if (permission.skill === undefined) return {}
  if (permission.skill === null || typeof permission.skill !== "object" || Array.isArray(permission.skill)) {
    throw new Error("OpenCode config permission.skill must be an object")
  }
  return permission.skill as SkillPermissions
}

function isFileNotFound(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT"
}
