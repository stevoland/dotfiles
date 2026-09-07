import { describe, expect, test } from "bun:test"
import { Model } from "@opencode/schema/model"

import {
  createGptUltraVariants,
  explicitGptDelegationReminder,
  isGptDelegationReminder,
  proactiveGptDelegationReminder,
  removeBuiltInDelegationPromptSection,
  resolveGptDelegationReminder,
} from "./delegation"

const providerID = "github-copilot" as Model.Info["providerID"]
const maxVariant = { id: Model.VariantID.make("max"), settings: { reasoningEffort: "max" } }
const xhighVariant = { id: Model.VariantID.make("xhigh"), settings: { reasoningEffort: "xhigh" } }

function gptModel(overrides: Partial<Model.Info> = {}): Model.Info {
  return {
    ...Model.Info.default(providerID, Model.ID.make("gpt-5.6-terra")),
    family: Model.Family.make("gpt-terra"),
    variants: [maxVariant],
    ...overrides,
  }
}

describe("removeBuiltInDelegationPromptSection", () => {
  test("removes Delegation through the following Markdown heading", () => {
    const prompt = `You are an AI agent powered by OpenCode, a coding agent harness.

# Harness
Keep going.

# Delegation
Do not delegate.

## Nested detail
Still delegation.

# Destructive actions
Preserve work.`

    expect(removeBuiltInDelegationPromptSection(prompt)).toBe(`You are an AI agent powered by OpenCode, a coding agent harness.

# Harness
Keep going.

## Nested detail
Still delegation.

# Destructive actions
Preserve work.`)
  })

  test("leaves project-authored and already transformed prompts unchanged", () => {
    expect(removeBuiltInDelegationPromptSection("# Delegation\nProject policy")).toBe("# Delegation\nProject policy")
    expect(removeBuiltInDelegationPromptSection("You are an AI agent powered by OpenCode, a coding agent harness.\n\n# Harness")).toBe(
      "You are an AI agent powered by OpenCode, a coding agent harness.\n\n# Harness",
    )
  })
})

describe("GPT ultra variants", () => {
  test("copies the complete maximum effort variant and replaces stale ultra", () => {
    const model = gptModel({
      variants: [
        { ...maxVariant, headers: { "x-reasoning": "max" }, body: { include: ["reasoning.encrypted_content"] } },
        { id: Model.VariantID.make("ultra"), settings: { reasoningEffort: "stale" } },
      ],
    })

    expect(createGptUltraVariants(model)).toEqual([
      { ...maxVariant, headers: { "x-reasoning": "max" }, body: { include: ["reasoning.encrypted_content"] } },
      {
        ...maxVariant,
        headers: { "x-reasoning": "max" },
        body: { include: ["reasoning.encrypted_content"] },
        id: Model.VariantID.make("ultra"),
      },
    ])
  })

  test("uses xhigh for Astra and does not invent an unsupported variant", () => {
    const astra = gptModel({ modelID: Model.ID.make("gpt-6-astra"), family: Model.Family.make("gpt-astra"), variants: [maxVariant, xhighVariant] })
    expect(createGptUltraVariants(astra)?.at(-1)).toEqual({ ...xhighVariant, id: Model.VariantID.make("ultra") })
    expect(createGptUltraVariants(gptModel({ variants: [] }))).toBeUndefined()
  })
})

describe("GPT delegation policy", () => {
  test("selects explicit or proactive reminders only for eligible GPT models", () => {
    const model = gptModel({ variants: [...gptModel().variants, { ...maxVariant, id: Model.VariantID.make("ultra") }] })
    const regular = { providerID, id: model.id }
    const ultra = { ...regular, variant: Model.VariantID.make("ultra") }

    expect(resolveGptDelegationReminder(regular, [model])).toBe(explicitGptDelegationReminder)
    expect(resolveGptDelegationReminder(ultra, [model])).toBe(proactiveGptDelegationReminder)
    expect(resolveGptDelegationReminder(regular, [])).toBeUndefined()
  })

  test("recognizes only exact durable reminders", () => {
    expect(isGptDelegationReminder(explicitGptDelegationReminder)).toBe(true)
    expect(isGptDelegationReminder(proactiveGptDelegationReminder)).toBe(true)
    expect(isGptDelegationReminder(`<conversation-checkpoint>${proactiveGptDelegationReminder}</conversation-checkpoint>`)).toBe(false)
  })
})
