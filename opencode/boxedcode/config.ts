// This plugin has been copied to ~/.config/opencode/plugins
// by https://github.com/eeveebank/nwb
// Ideally it would be provided by an npm package but
// we would have to ensure every dev has jfrog auth setup correctly.
// So for now we just copy it into the opencode plugins dir during setup.
//
// This plugin provides safe default config for opencode2
import { Plugin } from '@opencode-ai/plugin';
import { Model } from '@opencode-ai/schema/model';
import { Money } from '@opencode-ai/schema/money';

import {
  baseConfig,
  defaultModel,
  globalInstructions,
} from './boxedcode-shared/config-defaults.ts';

const BoxedCodeConfigPluginV2: Plugin.Plugin = {
  id: 'boxedcode-config',
  setup: async (context) => {
    await context.catalog.transform((catalog) => {
      const defaultRef = Model.Ref.parse(defaultModel);
      catalog.model.default.set(defaultRef.providerID, defaultRef.id);

      // Workaround https://github.com/anomalyco/opencode/issues/37389
      const copilotProvider = catalog.provider.get('github-copilot');
      copilotProvider?.models.forEach((model) => {
        if (!isGptWithResponsesEndpoint(String(model.id))) return;
        const settings = Reflect.get(model, 'settings');
        const draftSettings = isRecord(settings) ? settings : {};

        const include = Array.isArray(draftSettings['include']) ? draftSettings['include'] : [];
        delete draftSettings['previousResponseId'];
        Reflect.set(model, 'settings', {
          ...draftSettings,
          store: false,
          include: [...new Set([...include, 'reasoning.encrypted_content'])],
        });
      });

      for (const record of catalog.provider.list()) {
        const id = String(record.provider.id);
        if (id !== 'github-copilot' && id !== 'ollama') {
          catalog.provider.remove(String(record.provider.id));
        }
      }

      const configuredModels = baseConfig.provider['github-copilot'].models;
      if (!copilotProvider?.models) return;

      for (const [modelID, model] of copilotProvider.models) {
        if (!Object.hasOwn(configuredModels, String(model.id))) {
          catalog.model.update('github-copilot', modelID, (model) => {
            model.enabled = false;
          });
        }
      }

      for (const [modelID, config] of Object.entries(configuredModels)) {
        catalog.model.update('github-copilot', modelID, (model) => {
          model.name = config.name;
          if (hasModelCost(config)) {
            model.cost = [
              {
                input: Money.USDPerMillionTokens.make(config.cost.input),
                output: Money.USDPerMillionTokens.make(config.cost.output),
                cache: {
                  read: Money.USDPerMillionTokens.make(config.cost.cache_read ?? 0),
                  write: Money.USDPerMillionTokens.make(
                    'cache_write' in config.cost ? (config.cost.cache_write ?? 0) : 0,
                  ),
                },
              },
            ];
          }
          if ('limit' in config) {
            model.limit = { ...model.limit, ...config.limit };
          }
          if (hasModelModalities(config)) {
            model.capabilities = {
              ...model.capabilities,
              input: [...config.modalities.input],
              output: [...config.modalities.output],
            };
          }
        });
      }
    });

    await context.agent.transform((agents) => {
      for (const agent of agents.list()) {
        agents.update(String(agent.id), (draft) => {
          draft.system = [draft.system, globalInstructions]
            .filter((value): value is string => Boolean(value))
            .join('\n');

          const agents = baseConfig.agent;
          if (String(draft.id) in agents) {
            const agentId = String(draft.id) as keyof typeof agents;
            const agentConfig = agents[agentId];
            const model = Model.Ref.parse(String(agentConfig.model));
            draft.model = model;

            if ('variant' in agentConfig) {
              draft.model.variant = Model.VariantID.make(String(agentConfig.variant));
            }
          }
        });
      }
    });
  },
};

export default BoxedCodeConfigPluginV2;

const isGptWithResponsesEndpoint = (modelID: string) => {
  const match = /^gpt-(\d+)/.exec(modelID);
  if (!match) return false;
  return Number(match[1]) >= 5 && !modelID.startsWith('gpt-5-mini');
};

type ModelCost = {
  input: number;
  output: number;
  cache_read?: number;
  cache_write?: number;
};

type ModelModalities = {
  input: string[];
  output: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasModelCost = (config: object): config is object & { cost: ModelCost } => {
  const cost = Reflect.get(config, 'cost');
  return (
    isRecord(cost) &&
    typeof cost['input'] === 'number' &&
    typeof cost['output'] === 'number' &&
    (cost['cache_read'] === undefined || typeof cost['cache_read'] === 'number') &&
    (cost['cache_write'] === undefined || typeof cost['cache_write'] === 'number')
  );
};

const hasModelModalities = (config: object): config is object & { modalities: ModelModalities } => {
  const modalities = Reflect.get(config, 'modalities');
  return (
    isRecord(modalities) &&
    Array.isArray(modalities['input']) &&
    modalities['input'].every((value): value is string => typeof value === 'string') &&
    Array.isArray(modalities['output']) &&
    modalities['output'].every((value): value is string => typeof value === 'string')
  );
};
