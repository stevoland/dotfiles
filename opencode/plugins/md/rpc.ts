export const MdRpc = {
  id: "stevo.md",
  methods: {},
  events: {
    written: {
      schema: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
} as const
