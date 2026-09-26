/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, Show } from "solid-js"

import { generateLoonMessage } from "./loon"
import { loonContextUsage } from "./loon-context"

type LoonState = { enabled: boolean }

const LOON_ENABLED_STORAGE_KEY = "enabled"
const LOON_TOGGLE_LABEL = "◎[▪‿▪]◎"

/** Shows whether loon is enabled and toggles its persisted display state. */
function LoonFooter(props: {
  context: Plugin.Context
  enabled: () => boolean
  toggle: () => void
}) {
  const enabled = () => props.enabled()

  return (
    <box flexDirection="row" flexShrink={0} onMouseUp={props.toggle}>
      <text
        fg={enabled() ? props.context.theme.text.default : props.context.theme.text.subdued}
        attributes={enabled() ? undefined : TextAttributes.DIM}
      >
        {LOON_TOGGLE_LABEL}
      </text>
    </box>
  )
}

/** Shows completed loon text above the prompt while the persisted toggle is enabled. */
function LoonAbovePrompt(props: { context: Plugin.Context; sessionID: string; enabled: () => boolean }) {
  const dimensions = useTerminalDimensions()
  createEffect(() => {
    void props.context.data.session.message.sync(props.sessionID).catch(() => undefined)
  })
  const line = createMemo((previous: { sessionID: string; key: string; text: string } | undefined) => {
    const sessionID = props.sessionID
    const messages = props.context.data.session.message.list(sessionID)
    const session = props.context.data.session.get(sessionID)
    const usage = loonContextUsage(
      messages,
      props.context.data.location.model.list(session?.location),
      session?.revert?.messageID,
    )
    const next = generateLoonMessage(messages, usage)
    if (!next) return undefined
    // History pagination and streaming must not change a message already shown for this part.
    if (previous?.sessionID === sessionID && previous.key === next.key) return previous
    return { sessionID, ...next }
  })

  return (
    <Show when={props.enabled() && line()}>
      {(text) => (
        <box
          width="100%"
          flexShrink={0}
          alignItems="flex-end"
          maxHeight={5}
          overflow="hidden"
          border={["right"]}
          borderColor={props.context.theme.border.default}
          customBorderChars={{
            topLeft: "", bottomLeft: "", vertical: "┃", topRight: "", bottomRight: "",
            horizontal: " ", bottomT: "", topT: "", cross: "", leftT: "", rightT: "",
          }}
          paddingLeft={dimensions().width < 44 ? 4 : 6}
          paddingRight={dimensions().width < 44 ? 2 : 3}
        >
          <text
            fg={props.context.theme.text.subdued}
            attributes={TextAttributes.DIM}
            alignSelf="flex-end"
            wrapMode="word"
            maxWidth="100%"
          >
            {text().text}
          </text>
        </box>
      )}
    </Show>
  )
}

/** Displays deranged completed reasoning, falling back to completed assistant text when sparse. */
export default Plugin.define({
  id: "stevo.loon.tui",
  setup(context) {
    const [state, updateState] = context.storage.store<LoonState>(LOON_ENABLED_STORAGE_KEY, {
      initial: { enabled: true },
    })
    const toggle = () => {
      void updateState((draft) => {
        draft.enabled = !draft.enabled
      }).catch((error) => {
        context.ui.toast.show({
          title: "Loon",
          message: error instanceof Error ? error.message : String(error),
          variant: "error",
        })
      })
    }

    const disposePromptFooter = context.ui.slot({
      append: "prompt.footer.status",
      render: () => <LoonFooter context={context} enabled={() => state.enabled} toggle={toggle} />,
    })

    const disposeSessionComposer = context.ui.slot({
      append: "session.composer.top",
      render: ({ sessionID }) => (
        <LoonAbovePrompt context={context} sessionID={sessionID} enabled={() => state.enabled} />
      ),
    })

    return () => {
      disposePromptFooter()
      disposeSessionComposer()
    }
  },
})
