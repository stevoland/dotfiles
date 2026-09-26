/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createEffect, createMemo, createSignal, Show } from "solid-js"

import {
  barGlyphs,
  compactionThreshold,
  fractionColor,
  lastUsage,
  previousCompactionCount,
  remainingFraction,
} from "./power-bar"

/** Heavy horizontal-line power bar in one terminal row: full green when fresh, empty red at compaction. */
function PowerBar(props: { sessionID: string; context: Plugin.Context }) {
  const { context } = props
  const location = () => context.location ?? context.data.location.default()
  const buffer = typeof context.options.buffer === "number" ? context.options.buffer : undefined
  const [width, setWidth] = createSignal(0)
  const sessionMessages = createMemo(() => context.data.session.message.list(props.sessionID) ?? [])
  const compactionCount = createMemo(() => previousCompactionCount(sessionMessages()))

  createEffect(() => void context.data.session.message.sync(props.sessionID).catch(() => {}))
  createEffect(() => void context.data.location.model.sync(location()).catch(() => {}))

  const fraction = createMemo(() => {
    const messages = sessionMessages()
    const selected = context.ui.model.current()
    const ref = selected ? { providerID: selected.providerID, id: selected.modelID } : lastUsage(messages)?.model
    if (!ref) return undefined
    const model = context.data.location
      .model.list(location())
      ?.find((item) => item.providerID === ref.providerID && item.id === ref.id)
    const threshold = model && compactionThreshold(model.limit, buffer)
    if (threshold === undefined) return undefined
    return remainingFraction(lastUsage(messages, ref.providerID)?.tokens ?? 0, threshold)
  })
  const glyphs = createMemo(() => {
    const count = compactionCount()
    const labelWidth = count > 0 ? String(count).length + 1 : 0
    return barGlyphs(fraction() ?? 0, Math.max(0, width() - labelWidth))
  })

  return (
    <Show when={context.options.auto !== false && fraction() !== undefined}>
      <box
        flexDirection="row"
        flexShrink={0}
        height={1}
        width="100%"
        onSizeChange={function () {
          setWidth(this.width)
        }}
      >
        <Show when={compactionCount() > 0}>
          <text fg="#606060">{compactionCount()} </text>
        </Show>
        <text fg={fractionColor(fraction() ?? 0)}>{glyphs().filled}</text>
        <text fg="#202020">{"━".repeat(glyphs().track)}</text>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "stevo.power-bar.tui",
  setup(context) {
    return context.ui.slot({
      prepend: "session.composer.top",
      render: (input) => <PowerBar sessionID={input.sessionID} context={context} />,
    })
  },
})
