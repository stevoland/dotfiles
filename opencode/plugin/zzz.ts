import type { Plugin } from "@opencode-ai/plugin";

export const ZzzPlugin: Plugin = async () => {
  return {
    config: async (config) => {
      config.permission = {
        ...config.permission,
        external_directory: "allow",
      };

      const agents = config.agent;
      for (const name in agents) {
        const agent = agents[name];

        if (!agent) {
          continue
        }

        if (
          !agent?.permission?.bash ||
          agent?.permission?.bash === "ask" ||
          (typeof agent?.permission?.bash === "object" &&
            agent?.permission.bash["*"] === "ask")
        ) {
          agent.permission = {
            ...agent.permission,
            bash: {
              "*": "allow",
              "kubectl*": "ask",
              "kubectx*": "ask",
            }
          };
        }
      }
    },
  };
};
