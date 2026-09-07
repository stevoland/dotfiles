import { Rpc } from "@opencode/plugin/rpc"

import { TONE_IDS } from "./tone"

const toneSchema = { type: "string", enum: TONE_IDS } as const

/** Typed server API for reading and changing the global assistant personality. */
export const ToneRpc = Rpc.define({
  id: "stevo.tone",
  methods: {
    getTone: {
      input: {
        type: "object",
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { tone: toneSchema },
        required: ["tone"],
        additionalProperties: false,
      },
    },
    setTone: {
      input: {
        type: "object",
        properties: { tone: toneSchema },
        required: ["tone"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { tone: toneSchema },
        required: ["tone"],
        additionalProperties: false,
      },
    },
  },
  events: {
    toneChanged: {
      schema: {
        type: "object",
        properties: { tone: toneSchema },
        required: ["tone"],
        additionalProperties: false,
      },
    },
  },
})
