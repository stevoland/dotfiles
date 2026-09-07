import { define } from "@opencode/plugin/effect/plugin"
import { Effect } from "effect"
import { readFile } from "node:fs/promises"

import { ToneRpc } from "./rpc"
import { isToneID, isToneSystemReminder, toneSystemReminder, type ToneID } from "./tone"

const TONE_STORAGE_KEY = "selected-tone"

/** Injects the globally selected assistant personality into each model request's system context. */
export default define({
  id: "stevo.tone",
  effect: Effect.fn(function* (context) {
    const loonPrompt = yield* Effect.tryPromise(() => readFile(new URL("./loon.md", import.meta.url), "utf8")).pipe(
      Effect.orDie,
    )
    const rpc = yield* context.rpc.register(ToneRpc, {
      getTone: () =>
        Effect.gen(function* () {
          return { tone: yield* loadSelectedTone() }
        }),
      setTone: (input) =>
        Effect.gen(function* () {
          const tone = (input as { tone: unknown }).tone
          if (!isToneID(tone)) return yield* Effect.die("Tone plug-in: unsupported tone")

          yield* context.storage.set(TONE_STORAGE_KEY, tone)
          yield* rpc.events.emit("toneChanged", { tone }).pipe(
            Effect.catchCause((cause) => Effect.logWarning("Tone plug-in: failed to publish tone change", { cause })),
          )
          return { tone }
        }),
    }).pipe(Effect.orDie)

    yield* context.session.hook("context", (event) =>
      Effect.gen(function* () {
        const selectedTone = yield* loadSelectedTone()
        const selectedReminder = toneSystemReminder(selectedTone, loonPrompt)

        for (const systemPart of event.system) {
          if (systemPart.type === "text" && isToneSystemReminder(systemPart.text, loonPrompt)) return
        }

        event.system.push({ type: "text", text: selectedReminder })
      }),
    )

    function loadSelectedTone(): Effect.Effect<ToneID> {
      return context.storage.get(TONE_STORAGE_KEY).pipe(
        Effect.map((storedTone) => (isToneID(storedTone) ? storedTone : "default")),
      )
    }
  }),
})
