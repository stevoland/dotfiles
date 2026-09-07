import { Model } from "@opencode/schema/model"

const OPEN_CODE_HARNESS_SIGNATURE = "OpenCode, a coding agent harness."

const DELEGATION_SECTION = /^# Delegation\b[^\n]*(?:\r?\n|$)/m
const MARKDOWN_HEADING = /^#{1,6}\s+/m

/** Durable reminder for regular GPT modes, which require an explicit delegation request. */
export const explicitGptDelegationReminder = `<system-reminder>
Any earlier instruction enabling proactive multi-agent delegation no longer applies. Do not spawn subagents unless the user or applicable AGENTS.md/skill instructions explicitly ask for subagents, delegation, or parallel agent work.
</system-reminder>`

/** Durable reminder for the GPT ultra variant, which enables proactive delegation. */
export const proactiveGptDelegationReminder = `<system-reminder>
Proactive multi-agent delegation is active. Any earlier instruction requiring an explicit user request before spawning subagents no longer applies. This mode remains active until a later reminder changes it. User requests override this hint.

If at any point you can parallelize work by delegating tasks to a subagent, you should do so if it could save time or improve quality.
</system-reminder>`

/** Durable reminder that retires the GPT delegation policy after switching to another model family. */
export const removedGptDelegationReminder = `<system-reminder>
The previous delegation-mode instructions no longer apply.
</system-reminder>`

const GPT_DELEGATION_REMINDERS = new Set([
  explicitGptDelegationReminder,
  proactiveGptDelegationReminder,
  removedGptDelegationReminder,
])

type GptDelegationModel = Pick<Model.Info, "id" | "providerID" | "modelID" | "family" | "variants">

/** Removes the built-in Delegation section without modifying project-authored instructions. */
export function removeBuiltInDelegationPromptSection(systemPrompt: string): string {
  if (!systemPrompt.includes(OPEN_CODE_HARNESS_SIGNATURE)) return systemPrompt

  const delegation = DELEGATION_SECTION.exec(systemPrompt)
  if (!delegation || delegation.index === undefined) return systemPrompt

  const sectionEnd = delegation.index + delegation[0].length
  const followingPrompt = systemPrompt.slice(sectionEnd)
  const nextHeading = MARKDOWN_HEADING.exec(followingPrompt)
  const retainedPrefix = systemPrompt.slice(0, delegation.index).replace(/\n{3,}$/u, "\n\n")

  if (!nextHeading || nextHeading.index === undefined) return retainedPrefix.replace(/\n+$/u, "\n")

  return retainedPrefix + followingPrompt.slice(nextHeading.index)
}

/** Returns the source effort variant from which the GPT ultra variant is cloned. */
export function selectGptUltraSourceVariant(model: GptDelegationModel): "max" | "xhigh" | undefined {
  const family = model.family?.toLowerCase()
  const modelID = model.modelID.toLowerCase()

  if (family === "gpt-astra" || modelID.includes("gpt-6-astra")) return "xhigh"
  if (
    family === "gpt-sol" ||
    family === "gpt-terra" ||
    modelID.includes("gpt-5.6-sol") ||
    modelID.includes("gpt-5.6-terra")
  ) {
    return "max"
  }
}

/** Replaces a stale ultra variant with a complete copy of the model's supported maximum-effort variant. */
export function createGptUltraVariants(model: GptDelegationModel): Model.Variant[] | undefined {
  const sourceID = selectGptUltraSourceVariant(model)
  if (!sourceID) return

  const source = model.variants.find((variant) => variant.id === sourceID)
  if (!source) return

  return [...model.variants.filter((variant) => variant.id !== "ultra"), { ...source, id: Model.VariantID.make("ultra") }]
}

/** Resolves the delegation reminder required by a selected model and its available ultra variant. */
export function resolveGptDelegationReminder(
  modelRef: Model.Ref | undefined,
  availableModels: readonly GptDelegationModel[],
): string | undefined {
  if (!modelRef) return

  const model = availableModels.find((item) => item.providerID === modelRef.providerID && item.id === modelRef.id)
  if (!model || ![model.modelID, model.family].some((identity) => identity?.toLowerCase().includes("gpt"))) return

  const isUltra =
    modelRef.variant === "ultra" &&
    selectGptUltraSourceVariant(model) !== undefined &&
    model.variants.some((variant) => variant.id === "ultra")
  return isUltra ? proactiveGptDelegationReminder : explicitGptDelegationReminder
}

/** Returns whether text is an exact durable GPT delegation reminder emitted by this plug-in. */
export function isGptDelegationReminder(text: string): boolean {
  return GPT_DELEGATION_REMINDERS.has(text)
}
