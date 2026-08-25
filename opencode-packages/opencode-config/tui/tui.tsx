/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode-ai/plugin/tui"
import type { AgentInfo, SkillInfo } from "@opencode-ai/client"
import type { KeyEvent, Renderable, ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js"
import {
  getAgentSkillPermissionState,
  getSkillPermissionState,
  persistSkillPermission,
  resolveGlobalConfigPath,
  resolveLocalConfigPath,
  type AgentSkillPermissionState,
  type SkillPermissionState,
} from "../src/skill-permission-config.js"
import { readFile } from "node:fs/promises"
import { formatSkillLocation, sortSkillRows, type SkillSortMode } from "./skill-location.js"

const pluginID = "opencode-config"
type ConfigColumn = "project" | "global"

type SkillRow = {
  readonly skill: SkillInfo
  readonly normalizedLocation: string
  readonly agent: AgentSkillPermissionState
  readonly project: SkillPermissionState
  readonly global: SkillPermissionState
}

function SkillsButton(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const [hovered, setHovered] = createSignal(false)
  const open = () => void showSkillsDialog(props.context, props.sessionID)

  return (
    <box
      flexDirection="row"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      focusable
      backgroundColor={hovered() ? theme.background.element : undefined}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      onMouseUp={open}
      onKeyDown={(event) => {
        if (event.name === "return" || event.name === "space") open()
      }}
    >
      <text fg={theme.text.default}>Skills</text>
      <text fg={theme.text.subdued}>manage</text>
    </box>
  )
}

function SkillsDialog(props: {
  context: Plugin.Context
  skills: readonly SkillInfo[]
  directory: string
  agent: AgentInfo | undefined
}) {
  const theme = props.context.theme
  const [rows, setRows] = createSignal<SkillRow[]>([])
  const [selectedRow, setSelectedRow] = createSignal(0)
  const [selectedColumn, setSelectedColumn] = createSignal<ConfigColumn>("project")
  const [error, setError] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)
  const [projectPath, setProjectPath] = createSignal<string>()
  const [globalPath, setGlobalPath] = createSignal<string>()
  const [sortMode, setSortMode] = createSignal<SkillSortMode>("name")
  const sortedRows = createMemo(() => sortSkillRows(rows(), sortMode()))
  const hasSkills = createMemo(() => props.skills.length > 0)
  const dimensions = useTerminalDimensions()
  let dialogRoot: Renderable | undefined
  let skillsScroll: ScrollBoxRenderable | undefined
  const skillListHeight = createMemo(() =>
    Math.min(sortedRows().length, Math.max(4, Math.floor(dimensions().height / 2) - 6)),
  )

  createEffect(() => {
    const scroll = skillsScroll
    if (!scroll || sortedRows().length === 0) return
    const top = selectedRow()
    const bottom = top + 1
    const height = skillListHeight()
    if (top < scroll.scrollTop) scroll.scrollTo(top)
    if (bottom > scroll.scrollTop + height) scroll.scrollTo(bottom - height)
  })

  onMount(() => {
    props.context.ui.dialog.set({ size: "large", centered: true })
    dialogRoot?.focus()
    void loadSkillRows()
  })

  async function loadSkillRows() {
    try {
      const [nextProjectPath, nextGlobalPath] = await Promise.all([
        resolveLocalConfigPath(props.directory),
        resolveGlobalConfigPath(),
      ])
      setProjectPath(nextProjectPath)
      setGlobalPath(nextGlobalPath)
      const [projectText, globalText] = await Promise.all([
        readConfigIfPresent(nextProjectPath),
        readConfigIfPresent(nextGlobalPath),
      ])
      setRows(
        props.skills
          .slice()
          .map((skill) => ({
            skill,
            normalizedLocation: formatSkillLocation(props.context.ui.format.path(skill.location)),
            agent: props.agent ? getAgentSkillPermissionState(props.agent.permissions, skill.id) : "indeterminate",
            project: getSkillPermissionState(projectText, skill.id),
            global: getSkillPermissionState(globalText, skill.id),
          })),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  function moveRow(delta: number) {
    const count = rows().length
    if (count === 0) return
    setSelectedRow((current) => Math.max(0, Math.min(count - 1, current + delta)))
  }

  function moveColumn(delta: number) {
    setSelectedColumn(delta < 0 ? "project" : "global")
  }

  function toggleSelected() {
    const row = sortedRows()[selectedRow()]
    if (!row) return
    void toggleSkill(row, selectedColumn())
  }

  function toggleSortMode() {
    const selectedSkillID = sortedRows()[selectedRow()]?.skill.id
    const nextMode: SkillSortMode = sortMode() === "name" ? "location" : "name"
    setSortMode(nextMode)
    if (!selectedSkillID) return
    const nextSelectedRow = sortSkillRows(rows(), nextMode).findIndex((row) => row.skill.id === selectedSkillID)
    if (nextSelectedRow >= 0) setSelectedRow(nextSelectedRow)
  }

  async function toggleSkill(row: SkillRow, column: ConfigColumn) {
    if (busy()) return
    const state = nextSkillPermissionState(row[column])
    setBusy(true)
    try {
      const configPath = column === "project" ? projectPath() : globalPath()
      if (!configPath) throw new Error("Skills configuration paths are not ready")
      await persistSkillPermission(configPath, row.skill.id, state)
      setRows((current) =>
        current.map((currentRow) =>
          currentRow.skill.id === row.skill.id ? { ...currentRow, [column]: state } : currentRow,
        ),
      )
      const location = props.context.location ?? props.context.data.location.default()
      props.context.data.location.skill.invalidate(location)
      void props.context.data.location.skill.sync(location).catch(() => undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  function handleKeyDown(event: KeyEvent) {
    if (event.name === "escape") return props.context.ui.dialog.clear()
    if (event.name === "up" || event.name === "k") return moveRow(-1)
    if (event.name === "down" || event.name === "j") return moveRow(1)
    if (event.name === "left" || event.name === "h") return moveColumn(-1)
    if (event.name === "right" || event.name === "l" || event.name === "tab") return moveColumn(1)
    if (event.name === "s") return toggleSortMode()
    if (event.name === "return" || event.name === "space") return toggleSelected()
  }

  return (
    <box
      ref={(element: Renderable) => (dialogRoot = element)}
      flexDirection="column"
      paddingTop={0}
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={2}
      focusable
      onKeyDown={handleKeyDown}
    >
      <box flexDirection="row" marginBottom={1}>
        <text flexGrow={1} fg={theme.text.default}>
          Skill
        </text>
        <text width={10} fg={theme.text.subdued} truncate>
          {props.agent?.name ?? "Agent"}
        </text>
        <text width={10} fg={selectedColumn() === "project" ? theme.text.default : theme.text.subdued}>
          Project
        </text>
        <text width={10} fg={selectedColumn() === "global" ? theme.text.default : theme.text.subdued}>
          Global
        </text>
      </box>
      <Show when={!error()} fallback={<text fg={theme.text.feedback.error.default}>{error()}</text>}>
        <Show
          when={sortedRows().length > 0}
          fallback={
            <text fg={theme.text.subdued}>
              {hasSkills() ? "Loading skills…" : "No skills found."}
            </text>
          }
        >
          <scrollbox
            ref={(element: ScrollBoxRenderable) => (skillsScroll = element)}
            maxHeight={skillListHeight()}
            minHeight={0}
            scrollY
          >
            <box flexDirection="column">
              <For each={sortedRows()}>
                {(row, index) => (
                  <box
                    flexDirection="row"
                    backgroundColor={selectedRow() === index() ? theme.background.element : undefined}
                    onMouseUp={() => setSelectedRow(index())}
                  >
                    <box flexDirection="column" flexGrow={1} minWidth={0} paddingLeft={1}>
                      <text fg={theme.text.default} wrapMode="none" truncate>
                        {row.skill.name}
                        <span style={{ fg: theme.text.subdued }}>
                          {` ${row.normalizedLocation}`}
                        </span>
                      </text>
                    </box>
                    <AgentSkillPermission enabled={row.agent} theme={theme} />
                    <SkillToggle
                      enabled={row.project}
                      selected={selectedRow() === index() && selectedColumn() === "project"}
                      onSelect={() => {
                        setSelectedRow(index())
                        setSelectedColumn("project")
                      }}
                      onToggle={() => void toggleSkill(row, "project")}
                      theme={theme}
                    />
                    <SkillToggle
                      enabled={row.global}
                      selected={selectedRow() === index() && selectedColumn() === "global"}
                      onSelect={() => {
                        setSelectedRow(index())
                        setSelectedColumn("global")
                      }}
                      onToggle={() => void toggleSkill(row, "global")}
                      theme={theme}
                    />
                  </box>
                )}
              </For>
            </box>
          </scrollbox>
        </Show>
      </Show>
      <text marginTop={1} fg={theme.text.subdued}>
        <b>↑↓/jk</b> move <b>←→/hl</b> column <b>s</b> sort: {sortMode() === "name" ? "name → location" : "location → name"} <b>enter/space</b> toggle <b>esc</b> close
      </text>
      <Show when={busy()}>
        <text fg={theme.text.subdued}>Saving…</text>
      </Show>
    </box>
  )
}

function AgentSkillPermission(props: {
  enabled: AgentSkillPermissionState
  theme: Plugin.Context["theme"]
}) {
  return (
    <box width={10} justifyContent="center">
      <text
        fg={
          props.enabled === "allow"
            ? props.theme.text.feedback.success.default
            : props.enabled === "deny"
              ? props.theme.text.feedback.error.default
              : props.theme.text.subdued
        }
      >
        {props.enabled === "indeterminate" ? "-" : props.enabled}
      </text>
    </box>
  )
}

function SkillToggle(props: {
  enabled: SkillPermissionState
  selected: boolean
  onSelect: () => void
  onToggle: () => void
  theme: Plugin.Context["theme"]
}) {
  return (
    <box
      width={10}
      justifyContent="center"
      backgroundColor={props.selected ? props.theme.background.action.primary.focused : undefined}
      onMouseUp={() => {
        props.onSelect()
        props.onToggle()
      }}
    >
      <text
        fg={
          props.enabled === "allow"
            ? props.theme.text.feedback.success.default
            : props.enabled === "deny"
              ? props.theme.text.feedback.error.default
              : props.theme.text.subdued
        }
      >
        {props.enabled === "indeterminate" ? "-" : props.enabled}
      </text>
    </box>
  )
}

function nextSkillPermissionState(state: SkillPermissionState): SkillPermissionState {
  if (state === "indeterminate") return "allow"
  if (state === "allow") return "deny"
  return "indeterminate"
}

async function showSkillsDialog(context: Plugin.Context, sessionID: string) {
  try {
    const location = context.data.session.get(sessionID)?.location ?? context.location ?? context.data.location.default()
    await Promise.all([context.data.location.skill.sync(location), context.data.location.agent.sync(location)])
    const skills = context.data.location.skill.list(location) ?? []
    const sessionAgentID = context.data.session.get(sessionID)?.agent
    const agents = context.data.location.agent.list(location) ?? []
    const agent =
      agents.find((candidate) => candidate.id === sessionAgentID) ??
      agents.find((candidate) => candidate.mode !== "subagent" && !candidate.hidden)
    context.ui.dialog.show(() => (
      <SkillsDialog context={context} skills={skills} directory={location.directory} agent={agent} />
    ))
  } catch (cause) {
    context.ui.toast.show({
      title: "Skills unavailable",
      message: cause instanceof Error ? cause.message : String(cause),
      variant: "error",
    })
  }
}

async function readConfigIfPresent(configPath: string): Promise<string> {
  return readFile(configPath, "utf8").catch((error: unknown) => {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") return "{}"
    throw error
  })
}

/** Adds the skills button to the OpenCode sidebar and opens the agent/project/global skill dialog. */
export default Plugin.define({
  id: pluginID,
  setup(context) {
    return context.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }) => <SkillsButton context={context} sessionID={sessionID} />,
    })
  },
})
