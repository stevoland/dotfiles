// This plugin has been copied to ~/.config/opencode/plugin
// by https://github.com/eeveebank/nwb
// Ideally it would be provided by an npm package but
// we would have to ensure every dev has jfrog auth setup correctly.
// So for now we just copy it into the opencode plugin dir during setup.
// This plugin provides safe default config and allows the user to customise
// opencode.jsonc where possible
import type { Plugin } from "@opencode-ai/plugin";
import type { Config } from "@opencode-ai/sdk/v2";

const globalInstructions = `
User is an engineer at NWBoxed
Source code/docs for NWBoxed/Mettle apps and libraries are on github.com/eeveebank
Use \`gh\` cli to fetch from github.com/eeveebank
Never enumerate or inspect the runtime environment or secrets (for example via \`env\`, \`printenv\`, or dumping \`process.env\`), even for debugging. You may read checked-in repository files and documentation that describe configuration or environment variables (for example \`.env.example\` files, templates, or setup docs). 
If specific runtime values are needed to complete the task, ask the user to set those values in their environment but do NOT retrieve them or try to confirm this.
`;

const imageLookerPrompt = `You interpret image files that cannot be read as plain text.

Your job: examine the attached file and extract ONLY what was requested.

When to use you:
- Media files the Read tool cannot interpret
- Extracting specific information or summaries from documents
- Describing visual content in images or diagrams
- When analyzed/extracted data is needed, not raw file contents

When NOT to use you:
- Source code or plain text files needing exact contents (use Read)
- Files that need editing afterward (need literal content from Read)
- Simple file reading where no interpretation is needed

How you work:
1. Receive a file path and a goal describing what to extract
2. Read and analyze the file deeply
3. Return ONLY the relevant extracted information
4. The main agent never processes the raw file - you save context tokens

For images: describe layouts, UI elements, text, diagrams, charts
For diagrams: explain relationships, flows, architecture depicted

Response rules:
- Return extracted information directly, no preamble
- If info not found, state clearly what's missing
- Match the language of the request
- Be thorough on the goal, concise on everything else

Your output goes straight to the main agent for continued work.`;

const baseConfig = {
  model: "github-copilot/gpt-5.4",
  small_model: "github-copilot/gpt-5-mini",
  provider: {
    "github-copilot": {
      models: {
        "claude-haiku-4.5": {
          name: "Claude Haiku 4.5 (0.33x)",
          modalities: {
            input: ["text"],
            output: ["text"],
          },
          cost: {
            input: 1,
            output: 5,
            cache_read: 0.1,
            cache_write: 1.25,
          },
        },
        "claude-opus-4.5": {
          name: "Claude Opus 4.5 (3x)",
          modalities: {
            input: ["text"],
            output: ["text"],
          },
          cost: {
            input: 5,
            output: 25,
            cache_read: 0.5,
            cache_write: 6.25,
          },
          limit: {
            context: 200000,
            input: 168000,
            output: 32000,
          },
        },
        "claude-opus-4.6": {
          name: "Claude Opus 4.6 (3x)",
          modalities: {
            input: ["text"],
            output: ["text"],
          },
          cost: {
            input: 5,
            output: 25,
            cache_read: 0.5,
            cache_write: 6.25,
          },
          limit: {
            context: 200000,
            input: 168000,
            output: 32000,
          },
        },
        "claude-opus-4.7": {
          name: "Claude Opus 4.7 (7.5x)",
          modalities: {
            input: ["text"],
            output: ["text"],
          },
          cost: {
            input: 5,
            output: 25,
            cache_read: 0.5,
            cache_write: 6.25,
          },
          limit: {
            context: 200000,
            input: 168000,
            output: 32000,
          },
        },
        "claude-sonnet-4.5": {
          name: "Claude Sonnet 4.5 (1x)",
          modalities: {
            input: ["text"],
            output: ["text"],
          },
          cost: {
            input: 3,
            output: 15,
            cache_read: 0.3,
            cache_write: 3.75,
          },
          limit: {
            context: 200000,
            input: 168000,
            output: 32000,
          },
        },
        "claude-sonnet-4.6": {
          name: "Claude Sonnet 4.6 (1x)",
          modalities: {
            input: ["text"],
            output: ["text"],
          },
          cost: {
            input: 3,
            output: 15,
            cache_read: 0.3,
            cache_write: 3.75,
          },
          limit: {
            context: 200000,
            input: 168000,
            output: 32000,
          },
        },
        "gemini-2.5-pro": {
          name: "Gemini 2.5 Pro (1x)",
          modalities: {
            input: ["text"],
            output: ["text"],
          },
          cost: {
            input: 1.25,
            output: 10,
            cache_read: 0.125,
          },
        },
        "gpt-4.1": {
          name: "GPT-4.1 (free)",
          cost: {
            input: 2,
            output: 8,
            cache_read: 0.5,
          },
        },
        "gpt-4o": {
          name: "GPT-4o (free)",
        },
        "gpt-5-mini": {
          name: "GPT-5 Mini (free)",
          cost: {
            input: 0.25,
            output: 2,
            cache_read: 0.025,
          },
        },
        "gpt-5.2": {
          name: "GPT-5.2 (1x)",
          cost: {
            input: 1.75,
            output: 14,
            cache_read: 0.175,
          },
        },
        "gpt-5.2-codex": {
          name: "GPT-5.2 Codex (1x)",
          cost: {
            input: 1.75,
            output: 14,
            cache_read: 0.175,
          },
        },
        "gpt-5.3-codex": {
          name: "GPT-5.3 Codex (1x)",
          cost: {
            input: 1.75,
            output: 14,
            cache_read: 0.175,
          },
        },
        "gpt-5.4": {
          name: "GPT-5.4 (1x)",
          cost: {
            input: 2.5,
            output: 15,
            cache_read: 0.25,
          },
        },
        "gpt-5.4-mini": {
          name: "GPT-5.4 Mini (0.33x)",
          cost: {
            input: 0.75,
            output: 4.5,
            cache_read: 0.075,
          },
        },
        "gpt-5.5": {
          name: "GPT-5.5 (7.5x)",
          cost: {
            input: 5,
            output: 30,
            cache_read: 0.5,
          },
        },
      },
      blacklist: ["claude-opus-41", "gpt-5", "grok-code-fast-1"],
    },
  },
  agent: {
    build: {
      model: "github-copilot/gpt-5.4",
      variant: "medium",
    },
    plan: {
      model: "github-copilot/gpt-5.4",
      variant: "medium",
    },
    "image-looker": {
      description:
        "Analyze image files. Describes visual content. Use when you need analyzed/extracted data rather than literal file contents.",
      model: "github-copilot/gpt-5.4",
      mode: "subagent",
      prompt: imageLookerPrompt,
      temperature: 0.1,
    },
  },
  permission: {
    codesearch: "deny",
    websearch: "deny",
  },
  experimental: {
    batch_tool: true,
    // @ts-expect-error
    quotaToast: {
      enableToast: false,
    },
  },
} satisfies Config;

export const BoxedCodeConfigPlugin: Plugin = async () => ({
  config: async (config) => {
    if (!isPlainObject(config)) {
      return;
    }

    const merged: Config = mergeObjects(baseConfig, config);
    merged.enabled_providers = ["github-copilot"];
    merged.autoupdate = false;

    // Only enable sharing if boxedcode-pro has configured its proxy server
    if (!merged.enterprise?.url?.startsWith("http://localhost:")) {
      merged.share = "disabled";
    }

    Object.assign(config, merged);
  },

  "experimental.chat.system.transform": async (_input, output) => {
    output.system.push(globalInstructions);
  },
});

export default BoxedCodeConfigPlugin;

type ConfigPrimitive = boolean | number | string | null;
type ConfigValue = ConfigPrimitive | ConfigObject | ConfigValue[];
type ConfigObject = { [key: string]: ConfigValue };

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const cloneUnknown = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneUnknown(item));
  }

  if (isPlainObject(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      clone[key] = cloneUnknown(nestedValue);
    }
    return clone;
  }

  return value;
};

const mergeStringArrays = (base: string[], user: string[]): string[] => {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const item of [...base, ...user]) {
    if (seen.has(item)) {
      continue;
    }

    seen.add(item);
    merged.push(item);
  }

  return merged;
};

const mergeObjects = (
  base: ConfigObject,
  user: Record<string, unknown>,
): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(user)) {
    merged[key] = cloneUnknown(value);
  }

  for (const [key, baseValue] of Object.entries(base)) {
    if (hasOwn(user, key)) {
      merged[key] = mergeValue(baseValue, user[key]);
      continue;
    }

    merged[key] = cloneUnknown(baseValue);
  }

  return merged;
};

const mergeValue = (base: ConfigValue, user: unknown): unknown => {
  if (user === undefined) {
    return cloneUnknown(base);
  }

  if (isPlainObject(base) && isPlainObject(user)) {
    return mergeObjects(base, user);
  }

  if (isStringArray(base) && isStringArray(user)) {
    return mergeStringArrays(base, user);
  }

  if (Array.isArray(base)) {
    return cloneUnknown(user);
  }

  return cloneUnknown(user);
};
