// This plugin has been copied to ~/.config/opencode/plugin
// by https://github.com/eeveebank/nwb
// Ideally it would be provided by an npm package but
// we would have to ensure every dev has jfrog auth setup correctly.
// So for now we just copy it into the opencode plugin dir during setup.
// This plugin provides safe default config and allows the user to customise
// opencode.jsonc where possible
import type { Plugin } from '@opencode-ai/plugin';
import type { Config } from '@opencode-ai/sdk/v2';

import { baseConfig } from './boxedcode-shared/config-defaults.ts';

const globalInstructions = `
User is an engineer at NWBoxed
Never enumerate or inspect the runtime environment or secrets (for example via \`env\`, \`printenv\`, or dumping \`process.env\`), even for debugging. You may read checked-in repository files and documentation that describe configuration or environment variables (for example \`.env.example\` files, templates, or setup docs).
If specific runtime values are needed to complete the task, ask the user to set those values in their environment but do NOT retrieve them or try to confirm this.
`;

export const BoxedCodeConfigPlugin: Plugin = async () => ({
  config: async (config) => {
    if (!isPlainObject(config)) {
      return;
    }

    const merged: Config = mergeObjects(baseConfig, config);
    enforceProviderConfig(merged);
    if (merged?.provider?.['github-copilot']) {
      merged.provider['github-copilot'].whitelist = Object.keys(baseConfig.provider['github-copilot'].models)
    }
    merged.enabled_providers = ['github-copilot', 'ollama'];
    merged.autoupdate = false;

    // Only enable sharing if boxedcode-pro has configured its loopback proxy
    // server.
    const enterpriseUrl = merged.enterprise?.url;
    const isLoopbackShareProxy =
      enterpriseUrl?.startsWith('http://localhost:') ||
      enterpriseUrl?.startsWith('http://127.0.0.1:');
    if (!isLoopbackShareProxy) {
      merged.share = 'disabled';
    }

    Object.assign(config, merged);
  },

  'experimental.chat.system.transform': async (_input, output) => {
    output.system.push(globalInstructions);
  },
});

export default BoxedCodeConfigPlugin;

type ConfigPrimitive = boolean | number | string | null;
type ConfigValue = ConfigPrimitive | ConfigObject | ConfigValue[];
type ConfigObject = { [key: string]: ConfigValue };
const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const enforceProviderConfig = (config: Config): void => {
  const provider = isPlainObject(config.provider)
    ? config.provider
    : (cloneUnknown(baseConfig.provider) as Record<string, unknown>);
  if (!isPlainObject(provider['github-copilot'])) {
    provider['github-copilot'] = cloneUnknown(baseConfig.provider['github-copilot']);
  }
  (config as ConfigObject)['provider'] = provider as ConfigValue;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

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
