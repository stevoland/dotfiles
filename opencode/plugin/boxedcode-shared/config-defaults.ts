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
        'claude-opus-5': {
          name: 'Claude Opus 5 (Expensive)',
          limit: {
            context: 400000,
            input: 336000,
            output: 64000,
          },
        },
        'claude-opus-5.5': {
          name: 'Claude Opus 5.5 (Expensive)',
          limit: {
            context: 400000,
            input: 336000,
            output: 64000,
          },
        },
        'claude-sonnet-5': {
          name: 'Claude Sonnet 5 (Moderately priced)',
          limit: {
            context: 400000,
            input: 336000,
            output: 64000,
          },
        },
        'gemini-3.8-flash': {
          name: 'Gemini 3.8 Flash (Cheap)',
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
        'gpt-6-luna': {
          name: 'GPT-6 Luna (Cheap)',
          limit: {
            context: 400_000,
            input: 272_000,
            output: 128_000,
          },
        },
        'gpt-6-sol': {
          name: 'GPT-6 Sol (Moderately priced)',
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
    // Require approval for incident.io tools that can mutate state.
    incidentio_action_create: 'ask',
    incidentio_action_delete: 'ask',
    incidentio_action_update: 'ask',
    incidentio_alert_attach: 'ask',
    incidentio_alert_create_incident: 'ask',
    incidentio_alert_detach: 'ask',
    incidentio_alert_resolve: 'ask',
    incidentio_alert_tag_apply: 'ask',
    incidentio_cover_request_create: 'ask',
    incidentio_cover_request_manage: 'ask',
    incidentio_cover_request_respond: 'ask',
    incidentio_escalation_create: 'ask',
    incidentio_escalation_respond: 'ask',
    incidentio_extension_plugin_create: 'ask',
    incidentio_extension_plugin_sync: 'ask',
    incidentio_extension_plugin_update: 'ask',
    incidentio_extension_skill_feedback_update: 'ask',
    incidentio_feedback: 'ask',
    incidentio_follow_up_create: 'ask',
    incidentio_follow_up_update: 'ask',
    incidentio_incident_create: 'ask',
    incidentio_incident_merge: 'ask',
    incidentio_incident_message: 'ask',
    incidentio_incident_unmerge: 'ask',
    incidentio_incident_update: 'ask',
    incidentio_maintenance_window_create: 'ask',
    incidentio_maintenance_window_delete: 'ask',
    incidentio_maintenance_window_update: 'ask',
    incidentio_schedule_override_create: 'ask',
    incidentio_schedule_override_delete: 'ask',
    incidentio_status_page_update: 'ask',
  },
  experimental: {
    batch_tool: true,
    quotaToast: {
      enableToast: false,
    },
  },
};
