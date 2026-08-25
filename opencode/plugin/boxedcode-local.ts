// This plugin has been copied to ~/.config/opencode/plugin
// by https://github.com/eeveebank/nwb
// Ideally it would be provided by an npm package but
// we would have to ensure every dev has jfrog auth setup correctly.
// So for now we just copy it into the opencode plugin dir during setup.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'path';

import type { Hooks, Plugin } from '@opencode-ai/plugin';
import type { Config } from '@opencode-ai/sdk/v2';

import { defaultModel, defaultSmallModel } from './boxedcode-shared/config-defaults.ts';
import { resolveCommandPath } from './boxedcode-shared/run-command.ts';

const ollamaModelConfigs = new Map([
  [
    'gemma4:26b-mlx',
    {
      maxOutputTokens: 2000,
      temperature: 1.0,
      topP: 0.95,
      topK: 64,
      options: {},
    },
  ],
  [
    'gemma4:31b-mlx',
    {
      maxOutputTokens: 2000,
      temperature: 1.0,
      topP: 0.95,
      topK: 64,
      options: {},
    },
  ],
  [
    'gemma4:12b-mlx',
    {
      maxOutputTokens: 2000,
      temperature: 1.0,
      topP: 0.95,
      topK: 64,
      options: {},
    },
  ],
  [
    'gemma4:e4b-mlx',
    {
      maxOutputTokens: 2000,
      temperature: 1.0,
      topP: 0.95,
      topK: 64,
      options: {},
    },
  ],
  [
    'muse-glimmer:30b-mlx',
    {
      maxOutputTokens: 2000,
      temperature: 1.0,
      topP: 0.95,
      topK: 64,
      options: {},
    },
  ],
] as const);

type OllamaModelID = typeof ollamaModelConfigs extends Map<infer Key, unknown> ? Key : never;
type ChatParamsModel = Parameters<NonNullable<Hooks['chat.params']>>[0]['model'];

function isOllamaModelID(value: string): value is OllamaModelID {
  return ollamaModelConfigs.has(value as OllamaModelID);
}

function isOllamaModel(model: ChatParamsModel) {
  const values = [model.providerID, model.api?.url, model.api?.id, model.id];
  return values.some(
    (value) => typeof value === 'string' && value.toLowerCase().includes('ollama'),
  );
}

function getRequestedModelID(model: ChatParamsModel): OllamaModelID | undefined {
  const values = [model.id, model.name];

  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }

    const normalizedValue = value.startsWith('ollama/') ? value.slice('ollama/'.length) : value;
    if (isOllamaModelID(normalizedValue)) {
      return normalizedValue;
    }
  }

  return undefined;
}

const ollamaBaseURL = 'http://localhost:11434/v1';
const localModelProviders = ['ollama'] as const;

const allowedOllamaModels = Object.fromEntries(
  Array.from(ollamaModelConfigs.keys()).map((modelID) => [modelID, { name: modelID + ' (Free)' }]),
);
const allowedOllamaModelRefSet = new Set(
  Array.from(ollamaModelConfigs.keys()).map((modelID) => `ollama/${modelID}`),
);
const ollamaProviderConfig = {
  npm: '@ai-sdk/openai-compatible',
  name: 'Ollama (local)',
  options: { baseURL: ollamaBaseURL },
  models: allowedOllamaModels,
};

type ConfigObject = { [key: string]: ConfigValue };
type ShowToast = (toast: {
  body: {
    title: string;
    message: string;
    variant: 'warning' | 'success';
  };
}) => Promise<unknown>;
type OllamaPreflightDeps = {
  checkVersion: CheckOllamaVersion;
  checkModelInstalled: CheckOllamaModelInstalled;
  confirmPull: ConfirmOllamaPull;
  pullModel: PullOllamaModel;
  startServe: StartOllamaServe;
  warmModel: WarmOllamaModel;
  unloadModel: UnloadOllamaModel;
  retainSessionModel: RetainOllamaSessionModel;
  releaseSession: ReleaseOllamaSession;
  releaseInstance: ReleaseOllamaInstance;
  sleep: Sleep;
};
type ConfigPrimitive = boolean | number | string | null;
type ConfigValue = ConfigPrimitive | ConfigObject | ConfigValue[];
type AgentConfigRecord = Record<string, { model?: string } & Record<string, unknown>>;

const isAllowedOllamaModelRef = (value: string): boolean => allowedOllamaModelRefSet.has(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const sanitizeModelSelection = (value: unknown, fallback: string): unknown => {
  if (typeof value !== 'string' || !value.startsWith('ollama/')) return value;
  return isAllowedOllamaModelRef(value) ? value : fallback;
};

const enforceLocalProviderConfig = (config: Config): void => {
  const provider = isPlainObject(config.provider) ? config.provider : {};
  provider['ollama'] = ollamaProviderConfig;
  config['provider'] = provider;
  const existing = config.enabled_providers ? config.enabled_providers : [];
  const toAdd = localModelProviders.filter((p) => !(existing as unknown[]).includes(p));
  config['enabled_providers'] = [...existing, ...toAdd];
};

const sanitizeOllamaSelections = (config: Config): void => {
  (config as ConfigObject)['model'] = sanitizeModelSelection(
    config.model,
    defaultModel,
  ) as ConfigValue;
  (config as ConfigObject)['small_model'] = sanitizeModelSelection(
    config.small_model,
    defaultSmallModel,
  ) as ConfigValue;
  const agents = isPlainObject(config.agent) ? (config.agent as AgentConfigRecord) : undefined;
  if (!agents) return;
  for (const [, agentConfig] of Object.entries(agents)) {
    if (!isPlainObject(agentConfig) || typeof agentConfig['model'] !== 'string') continue;
    agentConfig['model'] = sanitizeModelSelection(agentConfig['model'], defaultModel) as string;
  }
};

type OllamaVersionResponse = {
  ok: boolean;
};

type CheckOllamaVersion = () => Promise<OllamaVersionResponse>;
type CheckOllamaModelInstalled = (modelID: string) => Promise<boolean>;
type ConfirmOllamaPull = (modelID: string) => Promise<boolean>;
type PullOllamaModel = (modelID: string) => Promise<void>;
type StartOllamaServe = () => Promise<void>;
type WarmOllamaModel = (modelID: string) => Promise<void>;
type UnloadOllamaModel = (modelID: string) => Promise<void>;
type Sleep = (ms: number) => Promise<void>;

type RetainOllamaSessionModel = (
  sessionID: string,
  modelID: string,
) => Promise<{ changed: boolean; unloadModelIDs: string[] }>;
type ReleaseOllamaSession = (sessionID: string) => Promise<string[]>;
type ReleaseOllamaInstance = () => Promise<string[]>;
type ResolveOllamaCommand = () => Promise<string>;

const ollamaCommand = '/opt/homebrew/bin/ollama';
const ollamaStartupAttempts = 600;
const defaultOllamaLeaseStateDir = join(
  homedir(),
  '.local',
  'state',
  'opencode',
  'boxedcode-ollama',
);
const ollamaLeaseLockMaxAgeMs = 10000;
const ollamaLeaseLockRetryMs = 50;
const ollamaLeaseLockRetries = 100;
const ollamaInstanceID = `${process.pid}-${Date.now()}`;
const defaultCheckOllamaVersion: CheckOllamaVersion = async () => {
  try {
    const response = await fetch('http://localhost:11434/api/version');
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
};

const defaultResolveOllamaCommand: ResolveOllamaCommand = async () => {
  return (await resolveCommandPath('ollama')) ?? ollamaCommand;
};

const defaultStartOllamaServe: StartOllamaServe = async () => {
  const command = await defaultResolveOllamaCommand();
  const child = spawn(command, ['serve'], {
    detached: true,
    stdio: 'ignore',
  });

  await new Promise<void>((resolve, reject) => {
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
    child.once('error', (error) => {
      reject(error);
    });
  });
};

const defaultCheckOllamaModelInstalled: CheckOllamaModelInstalled = async (modelID) => {
  const response = await fetch('http://localhost:11434/api/tags');
  if (!response.ok) {
    throw new Error(`Failed to list Ollama models: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    models?: Array<{ name?: string; model?: string }>;
  };
  return (body.models ?? []).some(({ name, model }) => name === modelID || model === modelID);
};

const defaultConfirmOllamaPull: ConfirmOllamaPull = async (modelID) => {
  const child = spawn('/usr/bin/osascript', [
    '-e',
    `display dialog "You haven't pulled ${modelID} yet. We can do this for you." buttons {"No", "Yes"} default button "Yes" cancel button "No" with title "Pull Ollama model"`,
  ]);

  return new Promise<boolean>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code === 0));
  });
};

const ollamaPullProgressScript = String.raw`
ObjC.import('AppKit')

const progressFile = $.NSProcessInfo.processInfo.arguments.lastObject.js
const app = $.NSApplication.sharedApplication
app.setActivationPolicy($.NSApplicationActivationPolicyAccessory)
const window = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(
  $.NSMakeRect(0, 0, 520, 140),
  $.NSWindowStyleMaskTitled,
  $.NSBackingStoreBuffered,
  false,
)
window.title = 'Pulling Ollama model'
window.center

const label = $.NSTextField.labelWithString('Starting pull...')
label.frame = $.NSMakeRect(24, 82, 472, 28)
label.lineBreakMode = $.NSLineBreakByTruncatingMiddle
window.contentView.addSubview(label)

const progress = $.NSProgressIndicator.alloc.initWithFrame($.NSMakeRect(24, 42, 472, 20))
progress.indeterminate = true
progress.minValue = 0
progress.maxValue = 100
progress.startAnimation(null)
window.contentView.addSubview(progress)
window.makeKeyAndOrderFront(null)
app.activateIgnoringOtherApps(true)

while (true) {
  try {
    const contents = ObjC.unwrap(
      $.NSString.stringWithContentsOfFileEncodingError(
        progressFile,
        $.NSUTF8StringEncoding,
        null,
      ),
    )
    const state = JSON.parse(contents)
    label.stringValue = state.status
    if (state.percentage !== undefined) {
      progress.indeterminate = false
      progress.doubleValue = state.percentage
    }
    if (state.done) break
  } catch (error) {
    // A write may briefly leave the file unreadable; retry on the next tick.
  }
  $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.1))
}
window.close
`;

const parseOllamaPullStatus = (chunk: string): { status: string; percentage?: number } | null => {
  const status = chunk
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .split(/[\r\n]/)
    .filter(Boolean)
    .at(-1)
    ?.trim();
  if (!status) return null;

  const percentage = status.match(/(\d+(?:\.\d+)?)%/)?.[1];
  return { status, ...(percentage === undefined ? {} : { percentage: Number(percentage) }) };
};

const defaultPullOllamaModel: PullOllamaModel = async (modelID) => {
  const command = await defaultResolveOllamaCommand();
  const progressDir = await mkdtemp(join(tmpdir(), 'boxedcode-ollama-pull-'));
  const progressFile = join(progressDir, 'progress.json');
  await writeFile(progressFile, JSON.stringify({ status: `Starting pull for ${modelID}...` }));
  const child = spawn(command, ['pull', modelID], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const progress = spawn('/usr/bin/osascript', [
    '-l',
    'JavaScript',
    '-e',
    ollamaPullProgressScript,
    progressFile,
  ]);
  const progressDone = new Promise<void>((resolve) => {
    progress.once('error', () => resolve());
    progress.once('exit', () => resolve());
  });
  let errorOutput = '';
  let statusWrite = Promise.resolve();

  const writeStatus = (status: string, percentage?: number, done = false): void => {
    statusWrite = statusWrite.then(() =>
      writeFile(
        progressFile,
        JSON.stringify({ status, ...(percentage === undefined ? {} : { percentage }), done }),
      ),
    );
  };

  const forwardStatus = (data: Buffer): void => {
    const parsed = parseOllamaPullStatus(data.toString());
    if (!parsed) return;
    writeStatus(parsed.status, parsed.percentage);
  };
  child.stdout.on('data', forwardStatus);
  child.stderr.on('data', (data: Buffer) => {
    errorOutput = data.toString();
    forwardStatus(data);
  });

  try {
    await new Promise<void>((resolve, reject) => {
      child.once('error', (error) => {
        writeStatus(error.message, undefined, true);
        reject(error);
      });
      child.once('exit', (code) => {
        if (code === 0) {
          writeStatus(`Pulled ${modelID}`, 100, true);
          resolve();
          return;
        }
        const detail = parseOllamaPullStatus(errorOutput)?.status;
        writeStatus(detail ?? `Pull failed with code ${code ?? 'unknown'}`, undefined, true);
        reject(
          new Error(
            `\`ollama pull ${modelID}\` exited with code ${code ?? 'unknown'}${detail ? `: ${detail}` : '.'}`,
          ),
        );
      });
    });
  } finally {
    await statusWrite.catch(() => {});
    await progressDone;
    await rm(progressDir, { recursive: true, force: true });
  }
};

const defaultWarmOllamaModel: WarmOllamaModel = async (modelID) => {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelID,
      prompt: '',
      stream: false,
      keep_alive: -1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to keep Ollama model warm: ${response.status} ${response.statusText}`);
  }
};

const defaultUnloadOllamaModel: UnloadOllamaModel = async (modelID) => {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelID,
      prompt: '',
      stream: false,
      keep_alive: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to unload Ollama model: ${response.status} ${response.statusText}`);
  }
};

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let activeOllamaLeaseStateDir = defaultOllamaLeaseStateDir;

const getOllamaLeaseRegistryPath = (): string => join(activeOllamaLeaseStateDir, 'registry.json');

const getOllamaLeaseLockPath = (): string => join(activeOllamaLeaseStateDir, 'registry.lock');

type OllamaLeaseRegistry = {
  instances: Record<string, true>;
  sessions: Record<string, { instanceID: string; modelID: string }>;
};

const createEmptyOllamaLeaseRegistry = (): OllamaLeaseRegistry => ({
  instances: {},
  sessions: {},
});

const getInstancePID = (instanceID: string): number | undefined => {
  const pidString = instanceID.split('-', 1)[0];
  const pid = pidString ? Number.parseInt(pidString, 10) : Number.NaN;
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
};

const isInstanceAlive = (instanceID: string): boolean => {
  const pid = getInstancePID(instanceID);
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const readOllamaLeaseRegistry = async (): Promise<OllamaLeaseRegistry> => {
  try {
    const raw = await readFile(getOllamaLeaseRegistryPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<OllamaLeaseRegistry>;
    return {
      instances: parsed.instances ?? {},
      sessions: parsed.sessions ?? {},
    };
  } catch {
    return createEmptyOllamaLeaseRegistry();
  }
};

const writeOllamaLeaseRegistry = async (registry: OllamaLeaseRegistry): Promise<void> => {
  await mkdir(activeOllamaLeaseStateDir, { recursive: true });
  await writeFile(getOllamaLeaseRegistryPath(), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
};

const countLeasedOllamaModels = (registry: OllamaLeaseRegistry): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const lease of Object.values(registry.sessions)) {
    counts.set(lease.modelID, (counts.get(lease.modelID) ?? 0) + 1);
  }
  return counts;
};

const getReleasedOllamaModels = (
  before: Map<string, number>,
  after: Map<string, number>,
): string[] => {
  const released: string[] = [];
  for (const [modelID, count] of before.entries()) {
    if (count > 0 && (after.get(modelID) ?? 0) === 0) {
      released.push(modelID);
    }
  }
  return released;
};

const cleanupStaleOllamaInstances = (registry: OllamaLeaseRegistry): void => {
  const aliveInstances = new Set<string>();
  for (const instanceID of Object.keys(registry.instances)) {
    if (isInstanceAlive(instanceID)) {
      aliveInstances.add(instanceID);
      continue;
    }

    delete registry.instances[instanceID];
  }

  for (const [sessionID, lease] of Object.entries(registry.sessions)) {
    if (!aliveInstances.has(lease.instanceID)) {
      delete registry.sessions[sessionID];
    }
  }
};

const withOllamaLeaseLock = async <T>(callback: () => Promise<T>): Promise<T> => {
  await mkdir(activeOllamaLeaseStateDir, { recursive: true });

  for (let attempt = 0; attempt < ollamaLeaseLockRetries; attempt++) {
    try {
      await writeFile(getOllamaLeaseLockPath(), `${ollamaInstanceID}\n`, {
        flag: 'wx',
      });
      try {
        return await callback();
      } finally {
        await rm(getOllamaLeaseLockPath(), { force: true });
      }
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code !== 'EEXIST') {
        throw error;
      }

      const lockStat = await stat(getOllamaLeaseLockPath()).catch(() => undefined);
      if (lockStat && Date.now() - lockStat.mtimeMs > ollamaLeaseLockMaxAgeMs) {
        await rm(getOllamaLeaseLockPath(), { force: true });
        continue;
      }

      await defaultSleep(ollamaLeaseLockRetryMs);
    }
  }

  throw new Error('Failed to acquire Ollama lease registry lock.');
};

const defaultRetainOllamaSessionModel: RetainOllamaSessionModel = async (sessionID, modelID) => {
  return withOllamaLeaseLock(async () => {
    const registry = await readOllamaLeaseRegistry();
    cleanupStaleOllamaInstances(registry);
    const before = countLeasedOllamaModels(registry);

    registry.instances[ollamaInstanceID] = true;

    const existingLease = registry.sessions[sessionID];
    const changed =
      existingLease?.instanceID !== ollamaInstanceID || existingLease?.modelID !== modelID;

    registry.sessions[sessionID] = {
      instanceID: ollamaInstanceID,
      modelID,
    };

    const after = countLeasedOllamaModels(registry);
    await writeOllamaLeaseRegistry(registry);

    return {
      changed,
      unloadModelIDs: getReleasedOllamaModels(before, after),
    };
  });
};

const defaultReleaseOllamaSession: ReleaseOllamaSession = async (sessionID) => {
  return withOllamaLeaseLock(async () => {
    const registry = await readOllamaLeaseRegistry();
    cleanupStaleOllamaInstances(registry);
    const before = countLeasedOllamaModels(registry);

    registry.instances[ollamaInstanceID] = true;
    delete registry.sessions[sessionID];

    const after = countLeasedOllamaModels(registry);
    await writeOllamaLeaseRegistry(registry);
    return getReleasedOllamaModels(before, after);
  });
};

const defaultReleaseOllamaInstance: ReleaseOllamaInstance = async () => {
  return withOllamaLeaseLock(async () => {
    const registry = await readOllamaLeaseRegistry();
    cleanupStaleOllamaInstances(registry);
    const before = countLeasedOllamaModels(registry);

    delete registry.instances[ollamaInstanceID];
    for (const [sessionID, lease] of Object.entries(registry.sessions)) {
      if (lease.instanceID === ollamaInstanceID) {
        delete registry.sessions[sessionID];
      }
    }

    const after = countLeasedOllamaModels(registry);
    await writeOllamaLeaseRegistry(registry);
    return getReleasedOllamaModels(before, after);
  });
};

let activeOllamaPreflightDeps: OllamaPreflightDeps = {
  checkVersion: defaultCheckOllamaVersion,
  checkModelInstalled: defaultCheckOllamaModelInstalled,
  confirmPull: defaultConfirmOllamaPull,
  pullModel: defaultPullOllamaModel,
  startServe: defaultStartOllamaServe,
  warmModel: defaultWarmOllamaModel,
  unloadModel: defaultUnloadOllamaModel,
  retainSessionModel: defaultRetainOllamaSessionModel,
  releaseSession: defaultReleaseOllamaSession,
  releaseInstance: defaultReleaseOllamaInstance,
  sleep: defaultSleep,
};
let ollamaReadinessPromise: Promise<void> | null = null;
let ollamaReady = false;

/**
 * Test-only hooks. Wrapped in a plain object because opencode's plugin loader
 * iterates every named export from files in `~/.config/opencode/plugin/` and
 * treats each function-valued export as a Plugin factory. A bare
 * `export const __setRunCommandForTests = (...): void => { ... }` was awaited
 * by the loader and the resulting `void` was then dereferenced as if it were
 * a hooks object, crashing opencode at startup with
 * `TypeError: undefined is not an object (evaluating 'L.provider')` (or its
 * minified `J[B]` variant when multiple plugins are present). Exporting an
 * object instead keeps the plugin file consumable by tests while making the
 * loader skip the helper. Production code never calls these.
 */
const testHooks = {
  parseOllamaPullStatus,
  setOllamaPreflightDeps: (deps?: Partial<OllamaPreflightDeps>): void => {
    activeOllamaPreflightDeps = {
      checkVersion: deps?.checkVersion ?? defaultCheckOllamaVersion,
      checkModelInstalled:
        deps?.checkModelInstalled ?? (deps ? async () => true : defaultCheckOllamaModelInstalled),
      confirmPull: deps?.confirmPull ?? (deps ? async () => true : defaultConfirmOllamaPull),
      pullModel: deps?.pullModel ?? (deps ? async () => {} : defaultPullOllamaModel),
      startServe: deps?.startServe ?? defaultStartOllamaServe,
      warmModel: deps?.warmModel ?? defaultWarmOllamaModel,
      unloadModel: deps?.unloadModel ?? defaultUnloadOllamaModel,
      retainSessionModel: deps?.retainSessionModel ?? defaultRetainOllamaSessionModel,
      releaseSession: deps?.releaseSession ?? defaultReleaseOllamaSession,
      releaseInstance: deps?.releaseInstance ?? defaultReleaseOllamaInstance,
      sleep: deps?.sleep ?? defaultSleep,
    };
  },
  resetOllamaState: (): void => {
    ollamaReadinessPromise = null;
    ollamaReady = false;
  },
  setOllamaLeaseStateDir: (stateDir?: string): void => {
    activeOllamaLeaseStateDir = stateDir ?? defaultOllamaLeaseStateDir;
  },
  clearOllamaLeaseState: async (): Promise<void> => {
    await rm(activeOllamaLeaseStateDir, { recursive: true, force: true });
  },
  defaultRetainOllamaSessionModel,
  defaultReleaseOllamaSession,
  defaultReleaseOllamaInstance,
};

const isOllamaProviderID = (value: unknown): boolean => value === 'ollama';

const isOllamaModelRef = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith('ollama/');

const normalizeOllamaModelID = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  return value.startsWith('ollama/') ? value.slice('ollama/'.length) : value;
};

const getProviderID = (value: unknown): string | undefined => {
  if (isOllamaModelRef(value)) {
    return 'ollama';
  }

  if (value === null || typeof value !== 'object') {
    return undefined;
  }

  const providerRecord = value as Record<string, unknown>;
  const providerInfo =
    providerRecord['info'] !== null && typeof providerRecord['info'] === 'object'
      ? (providerRecord['info'] as Record<string, unknown>)
      : undefined;
  const candidates = [
    providerRecord['id'],
    providerRecord['providerID'],
    providerRecord['name'],
    providerInfo?.['id'],
  ];
  for (const candidate of candidates) {
    if (isOllamaModelRef(candidate)) {
      return 'ollama';
    }

    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  return undefined;
};

type OllamaSelection = {
  sessionID: string;
  modelID: string;
};

const getOllamaModelID = (input: Record<string, unknown>): string | undefined => {
  const model = input['model'];
  if (typeof model === 'string') {
    return normalizeOllamaModelID(model);
  }

  if (model === null || typeof model !== 'object') {
    return undefined;
  }

  const modelRecord = model as Record<string, unknown>;
  const candidates = [modelRecord['id'], modelRecord['modelID'], modelRecord['name']];
  for (const candidate of candidates) {
    const normalized = normalizeOllamaModelID(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
};

const getOllamaSelection = (input: Record<string, unknown>): OllamaSelection | undefined => {
  if (isOllamaProviderID(getProviderID(input['provider']))) {
    const modelID = getOllamaModelID(input);
    return typeof input['sessionID'] === 'string' && modelID
      ? { sessionID: input['sessionID'], modelID }
      : undefined;
  }

  if (!isOllamaProviderID(getProviderID(input['model']))) {
    return undefined;
  }

  const modelID = getOllamaModelID(input);
  return typeof input['sessionID'] === 'string' && modelID
    ? { sessionID: input['sessionID'], modelID }
    : undefined;
};

const resetOllamaReadiness = (): void => {
  ollamaReady = false;
  ollamaReadinessPromise = null;
};

const notifyOllamaUnloadFailure = async (
  modelIDs: string[],
  showToast: ShowToast,
): Promise<void> => {
  const detail = modelIDs.length === 1 ? modelIDs[0] : `${modelIDs.length} models`;
  await showToast({
    body: {
      title: 'Failed to unload Ollama model',
      message: `BoxedCode could not unload ${detail} from Ollama. You may need to clear it manually.`,
      variant: 'warning',
    },
  });
};

const waitForOllamaReady = async (deps: OllamaPreflightDeps): Promise<void> => {
  for (let attempt = 0; attempt < ollamaStartupAttempts; attempt++) {
    const result = await deps.checkVersion();
    if (result.ok) {
      resetOllamaReadiness();
      ollamaReady = true;
      return;
    }

    await deps.sleep(500);
  }

  resetOllamaReadiness();
  throw new Error('Ollama did not become ready after starting `ollama serve`.');
};

const ensureOllamaDaemonReady = async (
  showToast: ShowToast,
  deps: OllamaPreflightDeps,
): Promise<void> => {
  if (ollamaReady) {
    const healthCheck = await deps.checkVersion().catch(() => ({ ok: false }));
    if (healthCheck.ok) {
      return;
    }

    resetOllamaReadiness();
  }

  if (!ollamaReadinessPromise) {
    ollamaReadinessPromise = (async () => {
      const versionCheck = await deps.checkVersion().catch(() => ({ ok: false }));
      if (versionCheck.ok) {
        ollamaReadinessPromise = null;
        ollamaReady = true;
        return;
      }

      await showToast({
        body: {
          title: 'Starting Ollama',
          message:
            'Ollama was not reachable. Launching `ollama serve` in the background. It may take up to 5 minutes to start properly.',
          variant: 'warning',
        },
      });
      await deps.startServe();
      await waitForOllamaReady(deps);
    })().catch((error) => {
      resetOllamaReadiness();
      throw error;
    });
  }

  await ollamaReadinessPromise;
};

const unloadOllamaModels = async (
  modelIDs: string[],
  showToast: ShowToast,
  deps: OllamaPreflightDeps,
): Promise<void> => {
  if (modelIDs.length === 0) {
    return;
  }

  const results = await Promise.allSettled(modelIDs.map((modelID) => deps.unloadModel(modelID)));
  const failed = results.flatMap((result, index) =>
    result.status === 'rejected' ? [modelIDs[index] ?? 'unknown model'] : [],
  );

  if (failed.length > 0) {
    await notifyOllamaUnloadFailure(failed, showToast);
  }
};

const isShutdownCommand = (command: string): boolean => {
  return (
    command === '/exit' ||
    command === '/quit' ||
    command === ':q' ||
    command === 'session.interrupt'
  );
};

const ensureOllamaReady = async (
  sessionID: string,
  modelID: string | undefined,
  showToast: ShowToast,
  deps: OllamaPreflightDeps,
): Promise<void> => {
  if (!modelID) {
    return;
  }

  const leaseResult = await deps.retainSessionModel(sessionID, modelID);
  await unloadOllamaModels(leaseResult.unloadModelIDs, showToast, deps);

  if (ollamaReady && !leaseResult.changed) {
    const healthCheck = await deps.checkVersion().catch(() => ({ ok: false }));
    if (healthCheck.ok) {
      return;
    }

    resetOllamaReadiness();
  }

  await ensureOllamaDaemonReady(showToast, deps);

  if (!(await deps.checkModelInstalled(modelID))) {
    if (!(await deps.confirmPull(modelID))) {
      throw new Error(`Ollama model ${modelID} has not been pulled.`);
    }

    await showToast({
      body: {
        title: 'Pulling Ollama model',
        message: `Pulling ${modelID} in the background. Your message will be sent when it is ready.`,
        variant: 'warning',
      },
    });
    await deps.pullModel(modelID);
  }

  try {
    await deps.warmModel(modelID);
  } catch {
    resetOllamaReadiness();
    await ensureOllamaDaemonReady(showToast, deps);
    await deps.warmModel(modelID);
  }
};

export const BoxedCodeLocalPlugin: Plugin = async ({ client }) => {
  const ollamaPreflightDeps = activeOllamaPreflightDeps;
  return {
    event: async ({ event }) => {
      if (event.type === 'server.instance.disposed') {
        const modelIDs = await ollamaPreflightDeps.releaseInstance();
        await unloadOllamaModels(
          modelIDs,
          client.tui.showToast.bind(client.tui),
          ollamaPreflightDeps,
        );
        return;
      }
      if (event.type === 'tui.command.execute' && isShutdownCommand(event.properties.command)) {
        const modelIDs = await ollamaPreflightDeps.releaseInstance();
        await unloadOllamaModels(
          modelIDs,
          client.tui.showToast.bind(client.tui),
          ollamaPreflightDeps,
        );
        return;
      }
      if (event.type === 'session.deleted') {
        const modelIDs = await ollamaPreflightDeps.releaseSession(event.properties.info.id);
        await unloadOllamaModels(
          modelIDs,
          client.tui.showToast.bind(client.tui),
          ollamaPreflightDeps,
        );
      }
    },
    config: async (config) => {
      enforceLocalProviderConfig(config);
      sanitizeOllamaSelections(config);
    },
    async 'chat.params'(input, output) {
      const selection = getOllamaSelection(input as Record<string, unknown>);
      if (selection) {
        await ensureOllamaReady(
          selection.sessionID,
          selection.modelID,
          client.tui.showToast.bind(client.tui),
          ollamaPreflightDeps,
        );
      }

      if (!isOllamaModel(input.model)) return;
      const modelID = getRequestedModelID(input.model);
      if (!modelID) return;
      const config = ollamaModelConfigs.get(modelID);
      if (!config) return;
      output.maxOutputTokens = config.maxOutputTokens;
      output.temperature = config.temperature;
      output.topP = config.topP;
      output.topK = config.topK;
      output.options = { ...output.options, ...config.options };
    },
  };
};

(
  BoxedCodeLocalPlugin as typeof BoxedCodeLocalPlugin & {
    __test: typeof testHooks;
  }
).__test = testHooks;

export default BoxedCodeLocalPlugin;
