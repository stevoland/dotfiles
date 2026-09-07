import { Message } from "@opencode/ai"
import { define } from "@opencode/plugin/effect/plugin"
import type { SessionEvent } from "@opencode/schema/session-event"
import { Effect, Stream } from "effect"

import {
  createGptUltraVariants,
  isGptDelegationReminder,
  removedGptDelegationReminder,
  removeBuiltInDelegationPromptSection,
  resolveGptDelegationReminder,
} from "./delegation"

/** Adds GPT ultra delegation mode and replaces the built-in static delegation policy per model request. */
export default define({
  id: "stevo.gpt-delegation",
  effect: Effect.fn(function* (context) {
    yield* context.model.transform((editor) => {
      for (const model of editor.list()) {
        const variants = createGptUltraVariants(model)
        if (!variants) continue

        editor.update(model.providerID, model.id, (draft) => {
          draft.variants = variants
        })
      }
    })

    yield* context.session.hook("context", (event) =>
      Effect.gen(function* () {
        for (const [index, systemPart] of event.system.entries()) {
          if (systemPart.type !== "text") continue
          event.system[index] = { ...systemPart, text: removeBuiltInDelegationPromptSection(systemPart.text) }
        }

        const models = (yield* context.model.list()).data
        const latestReminder = event.messages.reduce<string | undefined>((latest, message, index) => {
          if ((message.role !== "user" && message.role !== "system") || message.content.length !== 1) return latest
          const part = message.content[0]
          if (part?.type !== "text" || !isGptDelegationReminder(part.text)) return latest

          event.messages[index] = Message.make({ id: message.id, role: "system", content: part.text })
          return part.text
        }, undefined)

        const requiredReminder = resolveGptDelegationReminder(event.model, models) ?? (latestReminder ? removedGptDelegationReminder : undefined)
        if (!requiredReminder || requiredReminder === latestReminder) return

        const insertionIndex = event.messages.at(-1)?.role === "user" ? event.messages.length - 1 : event.messages.length
        event.messages.splice(insertionIndex, 0, Message.system(requiredReminder))
        yield* context.session.synthetic({ sessionID: event.sessionID, text: requiredReminder, resume: false }).pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("GPT delegation plug-in: failed to persist policy reminder", { sessionID: event.sessionID, cause }),
          ),
        )
      }).pipe(
        Effect.catch((error) =>
          Effect.logWarning("GPT delegation plug-in: failed to reconcile policy reminder", { sessionID: event.sessionID, error }),
        ),
      ),
    )

    yield* context.event.subscribe().pipe(
      Stream.filter(
        (event): event is SessionEvent.Created | SessionEvent.ModelSelected =>
          event.type === "session.created" || event.type === "session.model.selected",
      ),
      Stream.runForEach((event) =>
        Effect.gen(function* () {
          const models = (yield* context.model.list()).data
          const selectedModel = event.data.model
          const previousModel = event.type === "session.model.selected" ? event.data.previous : undefined
          const selectedReminder = resolveGptDelegationReminder(selectedModel, models)
          const previousReminder = resolveGptDelegationReminder(previousModel, models)
          if (selectedReminder === previousReminder) return

          yield* context.session
            .synthetic({
              sessionID: event.data.sessionID,
              text: selectedReminder ?? removedGptDelegationReminder,
              resume: false,
            })
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning("GPT delegation plug-in: failed to inject policy reminder", {
                  sessionID: event.data.sessionID,
                  cause,
                }),
              ),
            )
        }),
      ),
      Effect.forkScoped({ startImmediately: true }),
    )
  }),
})
