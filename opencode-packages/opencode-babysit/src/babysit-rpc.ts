import { Rpc } from "@opencode-ai/plugin/rpc"

/** RPC event contract announcing that a babysitter session has started. */
export const BabysitRpc = Rpc.define({
  id: "opencode-babysit",
  methods: {},
  events: {
    started: {
      schema: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
        },
        required: ["sessionID"],
        additionalProperties: false,
      },
    },
  },
})
