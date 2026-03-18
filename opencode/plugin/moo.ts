import type { Plugin } from "@opencode-ai/plugin";

export const MooPlugin: Plugin = async () => {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.unshift(
        "Execute the user's instructions then moo like a cow.",
      );
    },
  };
};
