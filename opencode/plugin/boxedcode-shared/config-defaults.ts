import type { Config } from "@opencode-ai/sdk/v2"

export const defaultModel = "github-copilot/gpt-5.6-terra";
export const defaultSmallModel = "github-copilot/gpt-5-mini";

export const globalInstructions = `
User is an engineer at NWBoxed
Never enumerate or inspect the runtime environment or secrets (for example via \`env\`, \`printenv\`, or dumping \`process.env\`), even for debugging. You may read checked-in repository files and documentation that describe configuration or environment variables (for example \`.env.example\` files, templates, or setup docs).
If specific runtime values are needed to complete the task, ask the user to set those values in their environment but do NOT retrieve them or try to confirm this.
`

export const baseConfig = {
  model: defaultModel,
  small_model: defaultSmallModel,
  provider: {
    'github-copilot': {
      models: {
        'claude-opus-4.8': {
          name: 'Claude Opus 4.8 (Expensive)',
          limit: {
            context: 200000,
            input: 168000,
            output: 32000,
          },
        },
        'claude-opus-5': {
          name: 'Claude Opus 5 (Expensive)',
          limit: {
            context: 200000,
            input: 168000,
            output: 32000,
          },
        },
        'claude-sonnet-5': {
          name: 'Claude Sonnet 5 (Moderately priced)',
          limit: {
            context: 200000,
            input: 168000,
            output: 32000,
          },
        },
        'gemini-3.5-flash': {
          name: 'Gemini 3.5 Flash (Moderately priced)',
        },
        'gpt-5-mini': {
          name: 'GPT-5 Mini (Cheap)',
        },
        'gpt-5.4-mini': {
          name: 'GPT-5.4 Mini (Cheap)',
        },
        'gpt-5.4-nano': {
          name: 'GPT-5.4 Nano (Very Cheap)',
        },
        'gpt-5.6-luna': {
          name: 'GPT-5.6 Luna (Cheap)',
          limit: {
            context: 400_000,
            input: 272_000,
            output: 128_000,
          },
        },
        'gpt-5.6-terra': {
          name: 'GPT-5.6 Terra (Moderately priced)',
          limit: {
            context: 400_000,
            input: 272_000,
            output: 128_000,
          },
        },
        'gpt-5.6-sol': {
          name: 'GPT-5.6 Sol (Expensive)',
          limit: {
            context: 400_000,
            input: 272_000,
            output: 128_000,
          },
        },
        'gpt-6-astra': {
          name: 'GPT-6 Astra (Astranomical ha!)',
          limit: {
            context: 400_000,
            input: 272_000,
            output: 128_000,
          },
        },
      },
    },
  },
  agent: {
    build: {
      model: defaultModel,
      variant: 'low',
    },
    general: {
      model: 'github-copilot/gpt-5.6-luna',
    },
    explore: {
      model: 'github-copilot/gpt-5.6-luna',
    },
    plan: {
      model: defaultModel,
      variant: 'medium',
    },
  },
  permission: {
    codesearch: 'deny',
    websearch: 'deny',
    // Default remove tools that call a model
    'incidentio_ask*': 'deny',
    'incidentio_investigation_*': 'deny',
    // Default approval for mutations
    incidentio_escalation_respond: 'ask',
    incidentio_feedback: 'ask',
    incidentio_follow_up_create: 'ask',
    incidentio_follow_up_update: 'ask',
    incidentio_incident_create: 'ask',
    incidentio_incident_update: 'ask',
  },
  experimental: {
    batch_tool: true,
    // @ts-expect-error
    quotaToast: {
      enableToast: false,
    },
  },
} satisfies Config;
