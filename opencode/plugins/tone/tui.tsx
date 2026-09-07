/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"

import { ToneRpc } from "./rpc"
import { isToneID, TONE_IDS, type ToneID } from "./tone"

const TONE_LABELS: Record<ToneID, string> = {
  default: "Default",
  lad: "Lad",
  loon: "Loon",
  simple: "Simple",
}

/** Shows the current assistant personality with a theatre-mask tone indicator in a footer. */
function ToneFooter(props: { tone: () => ToneID; cycleTone: () => void; context: Plugin.Context }) {
  return (
    <box flexDirection="row" flexShrink={0} onMouseUp={props.cycleTone}>
      <text fg={props.context.theme.hue.neutral[200]}>🎭</text>
      <text fg={props.context.theme.hue.neutral[400]}> {TONE_LABELS[props.tone()]}</text>
    </box>
  )
}

/** Adds a prompt footer control that cycles the globally persisted assistant personality. */
export default Plugin.define({
  id: "stevo.tone.tui",
  setup(context) {
    const toneRpc = context.client.rpc(ToneRpc)
    const [tone, setTone] = createSignal<ToneID>("default")

    const refreshTone = async () => {
      const selected = (await toneRpc.getTone({})) as { tone: unknown }
      setTone(isToneID(selected.tone) ? selected.tone : "default")
    }
    void refreshTone().catch((error) => showToneError(error))

    const unsubscribeToneChanges = toneRpc.events.on("toneChanged", (event) => {
      const selected = (event.data as { tone: unknown }).tone
      setTone(isToneID(selected) ? selected : "default")
    })

    const selectTone = (selectedTone: ToneID) => {
      void toneRpc
        .setTone({ tone: selectedTone })
        .then((selected) => {
          const returnedTone = (selected as { tone: unknown }).tone
          setTone(isToneID(returnedTone) ? returnedTone : "default")
        })
        .catch((error) => showToneError(error))
    }
    const cycleTone = () => {
      const currentIndex = TONE_IDS.indexOf(tone())
      const nextTone = TONE_IDS[(currentIndex + 1) % TONE_IDS.length]
      selectTone(nextTone)
    }

    const showToneError = (error: unknown) => {
      context.ui.toast.show({
        title: "Assistant tone",
        message: error instanceof Error ? error.message : String(error),
        variant: "error",
      })
    }

    const disposePromptFooter = context.ui.slot({
      append: "prompt.footer.status",
      render: () => <ToneFooter context={context} tone={tone} cycleTone={cycleTone} />,
    })

    return () => {
      unsubscribeToneChanges()
      disposePromptFooter()
    }
  },
})
